import { prisma } from '@/lib/prisma';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { notify, NOTIFICATION_TYPES } from '@/lib/notifications/service';
import type { ReviewSubmissionInput, SubmissionStatusValue } from '@/lib/validation/recruitment';
import { submissionReviewTransitions } from '@/lib/validation/recruitment';
import type { RequestMeta } from './auth-service';

export async function reviewSubmission(submissionId: string, input: ReviewSubmissionInput, actorUserId: string, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.clientUser.findUnique({ where: { userId: actorUserId }, select: { clientId: true } });
    if (!membership) throw new ForbiddenError('Client account is not configured');
    const submission = await tx.submission.findUnique({ where: { id: submissionId }, select: { id: true, clientId: true, status: true, candidateProfile: { select: { userId: true, firstName: true, lastName: true } }, job: { select: { title: true, recruiterId: true } } } });
    if (!submission) throw new NotFoundError('Submission');
    if (submission.clientId !== membership.clientId) throw new ForbiddenError('You cannot review another client submission');
    const job = submission.job;
    if (!job) throw new NotFoundError('Submission job');
    const allowed = submissionReviewTransitions[submission.status as SubmissionStatusValue] ?? [];
    if (!allowed.includes(input.status)) throw new BusinessRuleError(`Cannot transition a submission from ${submission.status} to ${input.status}`);
    const changed = await tx.submission.updateMany({ where: { id: submission.id, status: submission.status }, data: { status: input.status, clientFeedback: input.note || null } });
    if (changed.count !== 1) throw new ConflictError('Submission changed while reviewing it');
    await recordAudit({ action: AUDIT_ACTIONS.SUBMISSION_STATUS_CHANGED, entityType: 'Submission', entityId: submission.id, actorUserId, actorRole: 'CLIENT', metadata: { fromStatus: submission.status, toStatus: input.status, jobTitle: job.title }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    if (job.recruiterId) await notify({ userId: job.recruiterId, type: NOTIFICATION_TYPES.SUBMISSION_STATUS_CHANGED, title: 'Submission reviewed', body: `${submission.candidateProfile.firstName} ${submission.candidateProfile.lastName}'s submission for ${job.title} was updated.`, entityType: 'Submission', entityId: submission.id, link: '/recruiter' }, tx);
    return { id: submission.id, status: input.status };
  });
}
