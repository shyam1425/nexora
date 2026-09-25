import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { applyToJob } from '@/lib/services/application-service';
import { transitionApplicationStatus } from '@/lib/services/application-state';
import { registerCandidate } from '@/lib/services/auth-service';

async function removeUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { actorUserId: userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({ where: { userId } }),
    prisma.application.deleteMany({ where: { candidateProfile: { userId } } }),
    prisma.candidateProfile.deleteMany({ where: { userId } }),
    prisma.user.deleteMany({ where: { id: userId } }),
  ]);
}

describe('candidate application workflow', () => {
  it('persists an application, history, and duplicate protection', async () => {
    const suffix = randomUUID().slice(0, 8);
    const client = await prisma.client.create({ data: { name: `Test Client ${suffix}`, code: `test-client-${suffix}` } });
    const job = await prisma.job.create({ data: { clientId: client.id, title: `Test Role ${suffix}`, slug: `test-role-${suffix}`, description: 'Test role description', status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
    const email = `candidate.apply.${suffix}@example.com`;
    const password = 'StrongPass123';
    const registered = await registerCandidate({ firstName: 'Apply', lastName: 'Candidate', email, phone: '', password, confirmPassword: password, acceptTerms: true }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
    await prisma.user.update({ where: { id: registered.user.id }, data: { emailVerifiedAt: new Date() } });

    try {
      const application = await applyToJob(registered.user.id, { jobId: job.id, coverLetter: 'I am interested in this role.' }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      expect(application.status).toBe('APPLIED');
      const persisted = await prisma.application.findUnique({ where: { id: application.id }, include: { history: true } });
      expect(persisted?.history[0]?.toStatus).toBe('APPLIED');
      await expect(applyToJob(registered.user.id, { jobId: job.id, coverLetter: '' }, { ipAddress: '127.0.0.1', userAgent: 'vitest' })).rejects.toMatchObject({ code: 'CONFLICT' });
      const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null }, select: { id: true } });
      expect(admin).not.toBeNull();
      if (admin) {
        const changed = await transitionApplicationStatus(application.id, { toStatus: 'SCREENING', note: 'Ready for recruiter review' }, { userId: admin.id, role: 'SUPER_ADMIN' }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
        expect(changed.status).toBe('SCREENING');
        await expect(transitionApplicationStatus(application.id, { toStatus: 'OFFER_ACCEPTED' }, { userId: admin.id, role: 'SUPER_ADMIN' }, { ipAddress: '127.0.0.1', userAgent: 'vitest' })).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
      }
    } finally {
      await prisma.application.deleteMany({ where: { jobId: job.id } });
      await prisma.job.delete({ where: { id: job.id } });
      await prisma.client.delete({ where: { id: client.id } });
      await removeUser(registered.user.id);
    }
  });
});
