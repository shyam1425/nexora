import { prisma } from '@/lib/prisma';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { notify, NOTIFICATION_TYPES } from '@/lib/notifications/service';
import type { Role } from '@/generated/prisma/enums';
import type { CreateSubmissionInput } from '@/lib/validation/recruitment';
import type { RequestMeta } from './auth-service';

export async function createSubmission(input: CreateSubmissionInput, actor: { userId: string; role: Role }, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    if (!['SUPER_ADMIN', 'ADMIN', 'RECRUITER'].includes(actor.role)) throw new ForbiddenError('Only recruitment staff can submit candidates');
    const [client, job, candidate] = await Promise.all([
      tx.client.findFirst({ where: { id: input.clientId, deletedAt: null, status: 'ACTIVE' }, select: { id: true, name: true } }),
      tx.job.findFirst({ where: { id: input.jobId, clientId: input.clientId, deletedAt: null }, select: { id: true, title: true, status: true, recruiterId: true, createdById: true } }),
      tx.candidateProfile.findFirst({
        where: { id: input.candidateProfileId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          applications: {
            where: { jobId: input.jobId },
            select: { id: true, status: true },
            take: 1,
          },
        },
      }),
    ]);
    if (!client) throw new NotFoundError('Client');
    if (!job) throw new NotFoundError('Job');
    if (job.status !== 'PUBLISHED') throw new BusinessRuleError('Candidates can only be submitted for a published job');
    if (!candidate) throw new NotFoundError('Candidate profile');
    if (!candidate.applications.length) throw new NotFoundError('Candidate application for this job');
    if (['REJECTED', 'WITHDRAWN'].includes(candidate.applications[0].status)) throw new BusinessRuleError('Rejected or withdrawn candidates cannot be submitted');
    if (actor.role === 'RECRUITER' && ![job.recruiterId, job.createdById].includes(actor.userId)) throw new ForbiddenError('You are not assigned to this job');
    if (input.requirementId) {
      const requirement = await tx.requirement.findFirst({ where: { id: input.requirementId, clientId: client.id, deletedAt: null }, select: { id: true } });
      if (!requirement) throw new NotFoundError('Requirement');
    }
    const existing = await tx.submission.findUnique({ where: { clientId_jobId_candidateProfileId: { clientId: client.id, jobId: job.id, candidateProfileId: candidate.id } }, select: { id: true } });
    if (existing) throw new ConflictError('This candidate has already been submitted for this job');
    const submission = await tx.submission.create({ data: { clientId: client.id, requirementId: input.requirementId || null, jobId: job.id, candidateProfileId: candidate.id, submittedById: actor.userId, clientFeedback: input.note || null, status: 'SUBMITTED' }, select: { id: true, status: true, submittedAt: true, job: { select: { title: true } } } });
    await recordAudit({ action: AUDIT_ACTIONS.SUBMISSION_CREATED, entityType: 'Submission', entityId: submission.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { clientId: client.id, jobId: job.id, candidateId: candidate.id }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    const clientUsers = await tx.clientUser.findMany({ where: { clientId: client.id }, select: { userId: true } });
    for (const clientUser of clientUsers) await notify({ userId: clientUser.userId, type: NOTIFICATION_TYPES.SUBMISSION_RECEIVED, title: 'New candidate submission', body: `${candidate.firstName} ${candidate.lastName} was submitted for ${job.title}.`, entityType: 'Submission', entityId: submission.id, link: '/client' }, tx);
    return submission;
  });
}
