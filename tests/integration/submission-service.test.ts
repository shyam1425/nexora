import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createSubmission } from '@/lib/services/submission-service';
import { reviewSubmission } from '@/lib/services/submission-review-service';

const meta = { ipAddress: '127.0.0.1', userAgent: 'vitest-submission-test' };
type FixtureIds = { submissionIds: string[]; applicationIds: string[]; jobId: string; clientIds: string[]; clientUserIds: string[]; candidateProfileIds: string[]; userIds: string[] };

async function removeFixture(ids: FixtureIds) {
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { OR: [
      { actorUserId: { in: ids.userIds } },
      { entityType: 'Submission', entityId: { in: ids.submissionIds } },
    ] } }),
    prisma.notification.deleteMany({ where: { userId: { in: ids.userIds } } }),
    prisma.submission.deleteMany({ where: { id: { in: ids.submissionIds } } }),
    prisma.application.deleteMany({ where: { id: { in: ids.applicationIds } } }),
    prisma.job.deleteMany({ where: { id: ids.jobId } }),
    prisma.clientUser.deleteMany({ where: { id: { in: ids.clientUserIds } } }),
    prisma.client.deleteMany({ where: { id: { in: ids.clientIds } } }),
    prisma.candidateProfile.deleteMany({ where: { id: { in: ids.candidateProfileIds } } }),
    prisma.user.deleteMany({ where: { id: { in: ids.userIds } } }),
  ]);
}

describe('candidate submission workflow', () => {
  it('requires a real application, prevents duplicates, and isolates client review', async () => {
    const suffix = randomUUID().slice(0, 8);
    const ids: FixtureIds = { submissionIds: [], applicationIds: [], jobId: '', clientIds: [], clientUserIds: [], candidateProfileIds: [], userIds: [] };
    const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null }, select: { id: true } });
    expect(admin).not.toBeNull();
    if (!admin) throw new Error('Submission test requires a seeded super admin');

    try {
      const client = await prisma.client.create({ data: { name: `Submission Client ${suffix}`, code: `submission-client-${suffix}` } });
      const otherClient = await prisma.client.create({ data: { name: `Other Submission Client ${suffix}`, code: `other-submission-client-${suffix}` } });
      const job = await prisma.job.create({ data: { clientId: client.id, title: `Submission Role ${suffix}`, slug: `submission-role-${suffix}`, description: 'A role used to verify candidate submission persistence.', status: 'PUBLISHED', publishedAt: new Date(), recruiterId: admin.id, createdById: admin.id } });
      const candidateUser = await prisma.user.create({ data: { email: `submission-candidate-${suffix}@example.com`, passwordHash: 'test-only', role: 'CANDIDATE', status: 'ACTIVE', emailVerifiedAt: new Date(), name: 'Submission Candidate' } });
      const candidate = await prisma.candidateProfile.create({ data: { userId: candidateUser.id, firstName: 'Submission', lastName: 'Candidate', skills: [] } });
      const nonApplicantUser = await prisma.user.create({ data: { email: `non-applicant-${suffix}@example.com`, passwordHash: 'test-only', role: 'CANDIDATE', status: 'ACTIVE', emailVerifiedAt: new Date(), name: 'Non Applicant' } });
      const nonApplicant = await prisma.candidateProfile.create({ data: { userId: nonApplicantUser.id, firstName: 'Non', lastName: 'Applicant', skills: [] } });
      const application = await prisma.application.create({ data: { jobId: job.id, candidateProfileId: candidate.id, status: 'APPLIED' } });
      const clientUser = await prisma.user.create({ data: { email: `submission-client-user-${suffix}@example.com`, passwordHash: 'test-only', role: 'CLIENT', status: 'ACTIVE', emailVerifiedAt: new Date(), name: 'Submission Client User' } });
      const clientMembership = await prisma.clientUser.create({ data: { clientId: client.id, userId: clientUser.id } });
      const otherClientUser = await prisma.user.create({ data: { email: `other-client-user-${suffix}@example.com`, passwordHash: 'test-only', role: 'CLIENT', status: 'ACTIVE', emailVerifiedAt: new Date(), name: 'Other Client User' } });
      const otherMembership = await prisma.clientUser.create({ data: { clientId: otherClient.id, userId: otherClientUser.id } });
      ids.jobId = job.id; ids.clientIds.push(client.id, otherClient.id); ids.clientUserIds.push(clientMembership.id, otherMembership.id); ids.applicationIds.push(application.id); ids.candidateProfileIds.push(candidate.id, nonApplicant.id); ids.userIds.push(candidateUser.id, nonApplicantUser.id, clientUser.id, otherClientUser.id);

      const submission = await createSubmission({ clientId: client.id, jobId: job.id, candidateProfileId: candidate.id, note: 'Strong match for the role.' }, { userId: admin.id, role: 'SUPER_ADMIN' }, meta);
      ids.submissionIds.push(submission.id);
      expect(submission.status).toBe('SUBMITTED');
      await expect(createSubmission({ clientId: client.id, jobId: job.id, candidateProfileId: candidate.id, note: '' }, { userId: admin.id, role: 'SUPER_ADMIN' }, meta)).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(createSubmission({ clientId: client.id, jobId: job.id, candidateProfileId: nonApplicant.id, note: '' }, { userId: admin.id, role: 'SUPER_ADMIN' }, meta)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(reviewSubmission(submission.id, { status: 'CLIENT_REVIEW', note: 'Reviewing' }, otherClientUser.id, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      const reviewed = await reviewSubmission(submission.id, { status: 'CLIENT_REVIEW', note: 'Please assess the interview profile.' }, clientUser.id, meta);
      expect(reviewed.status).toBe('CLIENT_REVIEW');
      const persisted = await prisma.submission.findUnique({ where: { id: submission.id }, select: { status: true, clientFeedback: true } });
      expect(persisted).toEqual({ status: 'CLIENT_REVIEW', clientFeedback: 'Please assess the interview profile.' });
    } finally {
      await removeFixture(ids);
    }
  });
});

