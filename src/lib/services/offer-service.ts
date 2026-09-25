import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { notify, NOTIFICATION_TYPES } from '@/lib/notifications/service';
import type { Role } from '@/generated/prisma/enums';
import type { CreateOfferInput, OfferResponseInput } from '@/lib/validation/offer';
import type { RequestMeta } from './auth-service';

function assertStaff(actor: { userId: string; role: Role }, job: { recruiterId: string | null; createdById: string | null }) {
  if (!['SUPER_ADMIN', 'ADMIN', 'RECRUITER'].includes(actor.role)) throw new ForbiddenError('Only recruitment staff can manage offers');
  if (actor.role === 'RECRUITER' && ![job.recruiterId, job.createdById].includes(actor.userId)) throw new ForbiddenError('You are not assigned to this job');
}

export async function createAndSendOffer(input: CreateOfferInput, actor: { userId: string; role: Role }, meta: RequestMeta) {
  const offer = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({ where: { id: input.applicationId }, select: { id: true, status: true, candidateProfile: { select: { userId: true, firstName: true } }, job: { select: { title: true, recruiterId: true, createdById: true } } } });
    if (!application) throw new NotFoundError('Application');
    assertStaff(actor, application.job);
    if (application.status !== 'SELECTED') throw new BusinessRuleError('Only selected applications can receive an offer');
    if (input.validUntil && input.validUntil.getTime() <= Date.now()) throw new BusinessRuleError('Offer validity must be in the future');
    const changed = await tx.application.updateMany({ where: { id: application.id, status: 'SELECTED' }, data: { status: 'OFFERED' } });
    if (changed.count !== 1) throw new ConflictError('Application status changed while creating the offer');
    const created = await tx.offer.create({ data: { applicationId: application.id, designation: input.designation, annualCtc: input.annualCtc, currency: input.currency.toUpperCase(), joiningDate: input.joiningDate, validUntil: input.validUntil, probationMonths: input.probationMonths, location: input.location || null, notes: input.notes || null, status: 'SENT', createdById: actor.userId, sentAt: new Date() }, select: { id: true, applicationId: true, designation: true, annualCtc: true, currency: true, joiningDate: true, validUntil: true, status: true } });
    await tx.applicationStatusHistory.create({ data: { applicationId: application.id, fromStatus: 'SELECTED', toStatus: 'OFFERED', note: 'Offer created and sent', changedById: actor.userId } });
    await recordAudit({ action: AUDIT_ACTIONS.OFFER_CREATED, entityType: 'Offer', entityId: created.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { applicationId: application.id, designation: input.designation }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    await recordAudit({ action: AUDIT_ACTIONS.OFFER_SENT, entityType: 'Offer', entityId: created.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { applicationId: application.id }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    await notify({ userId: application.candidateProfile.userId, type: NOTIFICATION_TYPES.OFFER_RELEASED, title: 'Offer released', body: `An offer for ${application.job.title} is ready for your response.`, entityType: 'Offer', entityId: created.id, link: '/candidate' }, tx);
    return created;
  });
  return offer;
}

export async function respondToOffer(offerId: string, input: OfferResponseInput, actor: { userId: string; role: Role }, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findUnique({ where: { id: offerId }, select: { id: true, status: true, joiningDate: true, validUntil: true, application: { select: { id: true, status: true, candidateProfile: { select: { id: true, userId: true } }, job: { select: { title: true, clientId: true, recruiterId: true } } } } } });
    if (!offer) throw new NotFoundError('Offer');
    if (actor.role !== 'CANDIDATE' || actor.userId !== offer.application.candidateProfile.userId) throw new ForbiddenError('Only the candidate can respond to this offer');
    if (offer.status !== 'SENT') throw new ConflictError('This offer has already been answered or withdrawn');
    if (offer.validUntil && offer.validUntil.getTime() <= Date.now()) throw new BusinessRuleError('This offer has expired');
    const changedOffer = await tx.offer.updateMany({ where: { id: offer.id, status: 'SENT' }, data: { status: input.decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date(), responseNote: input.responseNote || null } });
    if (changedOffer.count !== 1) throw new ConflictError('Offer response changed while you were submitting it');

    if (input.decision === 'DECLINE') {
      const changedApplication = await tx.application.updateMany({ where: { id: offer.application.id, status: 'OFFERED' }, data: { status: 'OFFER_DECLINED' } });
      if (changedApplication.count !== 1) throw new ConflictError('Application status changed while responding');
      await tx.applicationStatusHistory.create({ data: { applicationId: offer.application.id, fromStatus: 'OFFERED', toStatus: 'OFFER_DECLINED', note: input.responseNote || 'Candidate declined the offer', changedById: actor.userId } });
      await recordAudit({ action: AUDIT_ACTIONS.OFFER_DECLINED, entityType: 'Offer', entityId: offer.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { applicationId: offer.application.id }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
      await notify({ userId: offer.application.candidateProfile.userId, type: NOTIFICATION_TYPES.OFFER_DECLINED, title: 'Offer response recorded', body: `Your response for ${offer.application.job.title} was recorded.`, entityType: 'Offer', entityId: offer.id, link: '/candidate' }, tx);
      return { status: 'DECLINED' as const, joining: null };
    }

    const changedApplication = await tx.application.updateMany({ where: { id: offer.application.id, status: 'OFFERED' }, data: { status: 'JOINING' } });
    if (changedApplication.count !== 1) throw new ConflictError('Application status changed while accepting the offer');
    await tx.applicationStatusHistory.create({ data: { applicationId: offer.application.id, fromStatus: 'OFFERED', toStatus: 'OFFER_ACCEPTED', note: 'Candidate accepted the offer', changedById: actor.userId } });
    await tx.applicationStatusHistory.create({ data: { applicationId: offer.application.id, fromStatus: 'OFFER_ACCEPTED', toStatus: 'JOINING', note: 'Joining workflow started', changedById: actor.userId } });
    let employeeCode = '';
    do { employeeCode = `WF-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`; } while (await tx.joining.findUnique({ where: { employeeCode }, select: { id: true } }));
    const joining = await tx.joining.create({ data: { offerId: offer.id, applicationId: offer.application.id, candidateProfileId: offer.application.candidateProfile.id, employeeCode, plannedJoiningDate: offer.joiningDate, status: 'PENDING', documentsPending: true, createdById: actor.userId }, select: { id: true, employeeCode: true, plannedJoiningDate: true, status: true } });
    await recordAudit({ action: AUDIT_ACTIONS.OFFER_ACCEPTED, entityType: 'Offer', entityId: offer.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { applicationId: offer.application.id, joiningId: joining.id }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    await recordAudit({ action: AUDIT_ACTIONS.JOINING_CREATED, entityType: 'Joining', entityId: joining.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { applicationId: offer.application.id, employeeCode }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    await notify({ userId: offer.application.candidateProfile.userId, type: NOTIFICATION_TYPES.JOINING_SCHEDULED, title: 'Joining workflow started', body: `Your joining record for ${offer.application.job.title} is being prepared.`, entityType: 'Joining', entityId: joining.id, link: '/candidate' }, tx);
    if (offer.application.job.recruiterId) await notify({ userId: offer.application.job.recruiterId, type: NOTIFICATION_TYPES.OFFER_ACCEPTED, title: 'Offer accepted', body: `The candidate accepted the offer for ${offer.application.job.title}.`, entityType: 'Offer', entityId: offer.id, link: '/recruiter' }, tx);
    return { status: 'ACCEPTED' as const, joining };
  });
}

