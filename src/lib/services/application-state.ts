import { prisma } from '@/lib/prisma';
import { ConflictError, ForbiddenError, NotFoundError, BusinessRuleError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { notify, NOTIFICATION_TYPES } from '@/lib/notifications/service';
import type { Role } from '@/generated/prisma/enums';
import type { ApplicationStatusValue, TransitionApplicationInput } from '@/lib/validation/recruitment';
import type { RequestMeta } from './auth-service';

const transitions: Record<ApplicationStatusValue, readonly ApplicationStatusValue[]> = {
  APPLIED: ['SCREENING', 'REJECTED', 'WITHDRAWN'],
  SCREENING: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW_SCHEDULED: ['INTERVIEW_COMPLETED', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW_COMPLETED: ['SELECTED', 'REJECTED'],
  SELECTED: ['OFFERED', 'REJECTED'],
  OFFERED: ['OFFER_ACCEPTED', 'OFFER_DECLINED', 'WITHDRAWN'],
  OFFER_ACCEPTED: ['JOINING'],
  OFFER_DECLINED: [],
  JOINING: ['JOINED'],
  JOINED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

/**
 * These target states carry records or workflow side effects and must only be
 * written by their owning transaction service. The generic application status
 * API is deliberately not a back door into interview, offer, or joining data.
 */
const workflowManagedTransitions: Partial<Record<ApplicationStatusValue, string>> = {
  INTERVIEW_SCHEDULED: 'the interview scheduling workflow',
  INTERVIEW_COMPLETED: 'the interview feedback workflow',
  OFFERED: 'the offer creation workflow',
  OFFER_ACCEPTED: 'the candidate offer response workflow',
  OFFER_DECLINED: 'the candidate offer response workflow',
  JOINING: 'the offer acceptance workflow',
  JOINED: 'the joining completion workflow',
};

export function canTransitionApplication(from: ApplicationStatusValue, to: ApplicationStatusValue): boolean {
  return transitions[from].includes(to);
}

/** True only for a graph-valid transition safe for the generic status API. */
export function canManuallyTransitionApplication(
  from: ApplicationStatusValue,
  to: ApplicationStatusValue,
): boolean {
  return canTransitionApplication(from, to) && !workflowManagedTransitions[to];
}

export async function transitionApplicationStatus(
  applicationId: string,
  input: TransitionApplicationInput,
  actor: { userId: string; role: Role },
  meta: RequestMeta,
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      status: true,
      candidateProfile: { select: { userId: true } },
      job: { select: { title: true, recruiterId: true, createdById: true } },
    },
  });
  if (!application) throw new NotFoundError('Application');

  const isCandidate = actor.role === 'CANDIDATE';
  if (isCandidate && (actor.userId !== application.candidateProfile.userId || input.toStatus !== 'WITHDRAWN')) {
    throw new ForbiddenError('Candidates can only withdraw their own application');
  }
  if (!isCandidate && !['SUPER_ADMIN', 'ADMIN', 'RECRUITER'].includes(actor.role)) {
    throw new ForbiddenError('Only recruitment staff can update application status');
  }
  if (actor.role === 'RECRUITER' && ![application.job.recruiterId, application.job.createdById].includes(actor.userId)) {
    throw new ForbiddenError('You are not assigned to this job');
  }

  if (!canManuallyTransitionApplication(application.status, input.toStatus)) {
    const workflowOwner = workflowManagedTransitions[input.toStatus];
    if (workflowOwner) {
      throw new BusinessRuleError(
        `${input.toStatus.replaceAll('_', ' ')} is updated by ${workflowOwner}`,
      );
    }
    throw new BusinessRuleError(
      `Cannot transition an application from ${application.status} to ${input.toStatus}`,
    );
  }

  const fromStatus = application.status;
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.application.updateMany({
      where: { id: applicationId, status: fromStatus },
      data: {
        status: input.toStatus,
        ...(input.toStatus === 'REJECTED' ? { rejectionReason: input.note || 'Rejected by recruitment team' } : {}),
        ...(input.toStatus === 'WITHDRAWN' ? { withdrawnAt: new Date() } : {}),
        ...(input.toStatus === 'JOINED' ? { joinedAt: new Date() } : {}),
      },
    });
    if (result.count !== 1) throw new ConflictError('Application changed while you were updating it');
    const next = await tx.application.findUnique({ where: { id: applicationId }, select: { id: true, status: true, updatedAt: true } });
    if (!next) throw new NotFoundError('Application');
    await tx.applicationStatusHistory.create({ data: { applicationId, fromStatus, toStatus: input.toStatus, note: input.note || null, changedById: actor.userId } });
    await recordAudit({ action: AUDIT_ACTIONS.APPLICATION_STATUS_CHANGED, entityType: 'Application', entityId: applicationId, actorUserId: actor.userId, actorRole: actor.role, metadata: { fromStatus, toStatus: input.toStatus, jobTitle: application.job.title }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    await notify({ userId: application.candidateProfile.userId, type: NOTIFICATION_TYPES.APPLICATION_STATUS_CHANGED, title: 'Application status updated', body: `${application.job.title} is now ${input.toStatus.toLowerCase().replaceAll('_', ' ')}.`, entityType: 'Application', entityId: applicationId, link: '/candidate' }, tx);
    return next;
  });
  return updated;
}
