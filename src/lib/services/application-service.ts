import { prisma, type PrismaTx } from '@/lib/prisma';
import { ConflictError, NotFoundError, AppError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { notify, NOTIFICATION_TYPES } from '@/lib/notifications/service';
import type { RequestMeta } from './auth-service';
import type { ApplyToJobInput } from '@/lib/validation/recruitment';

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function applyToJob(
  candidateUserId: string,
  input: ApplyToJobInput,
  meta: RequestMeta,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const [candidate, job] = await Promise.all([
        tx.candidateProfile.findUnique({ where: { userId: candidateUserId }, select: { id: true } }),
        tx.job.findFirst({
          where: { id: input.jobId, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null },
          select: { id: true, title: true, recruiterId: true, createdById: true },
        }),
      ]);
      if (!candidate) throw new NotFoundError('Candidate profile');
      if (!job) throw new NotFoundError('Job');

      const existing = await tx.application.findUnique({
        where: { jobId_candidateProfileId: { jobId: job.id, candidateProfileId: candidate.id } },
        select: { id: true, status: true },
      });
      if (existing) throw new ConflictError('You have already applied to this role');

      const application = await tx.application.create({
        data: {
          jobId: job.id,
          candidateProfileId: candidate.id,
          coverLetter: input.coverLetter || null,
          source: 'CAREERS_PAGE',
          history: { create: { toStatus: 'APPLIED', note: 'Application submitted from careers page' } },
        },
        select: { id: true, status: true, appliedAt: true, job: { select: { title: true } } },
      });

      await recordAudit({
        action: AUDIT_ACTIONS.APPLICATION_CREATED,
        entityType: 'Application',
        entityId: application.id,
        actorUserId: candidateUserId,
        actorRole: 'CANDIDATE',
        metadata: { jobId: job.id, jobTitle: job.title, source: 'CAREERS_PAGE' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      }, tx);

      const recruiterId = job.recruiterId ?? job.createdById;
      if (recruiterId) {
        await notify({
          userId: recruiterId,
          type: NOTIFICATION_TYPES.APPLICATION_RECEIVED,
          title: 'New application received',
          body: `${job.title} has a new candidate application.`,
          entityType: 'Application',
          entityId: application.id,
          link: `/recruiter/applications/${application.id}`,
        }, tx);
      }

      return application;
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueConstraintError(error)) throw new ConflictError('You have already applied to this role');
    throw error;
  }
}

export type ApplicationWithJob = Awaited<ReturnType<typeof applyToJob>>;
export type ApplicationClient = PrismaTx | typeof prisma;
