import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { registerCandidate } from '@/lib/services/auth-service';
import { updateCandidateProfile } from '@/lib/services/candidate-profile-service';

async function removeUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { actorUserId: userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({ where: { userId } }),
    prisma.candidateProfile.deleteMany({ where: { userId } }),
    prisma.user.deleteMany({ where: { id: userId } }),
  ]);
}

describe('candidate profile updates', () => {
  it('persists candidate profile edits, syncs user identity, and rejects non-candidate actors', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registered = await registerCandidate({ firstName: 'Profile', lastName: 'Owner', email: `candidate.profile.${suffix}@example.com`, phone: '', password: 'StrongPass123', confirmPassword: 'StrongPass123', acceptTerms: true }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
    try {
      const input = { firstName: 'Updated', lastName: 'Candidate', phone: '+91 90000 00002', city: 'Bengaluru', state: 'Karnataka', country: 'India', headline: 'Senior TypeScript Engineer', summary: 'Profile summary for integration testing.', totalExperienceMonths: 48, currentCtc: 1200000, expectedCtc: 1500000, noticePeriodDays: 30, currentCompany: 'Example Labs', currentDesignation: 'Engineer', skills: ['TypeScript', 'Next.js'], linkedinUrl: 'https://www.linkedin.com/in/profile-test', portfolioUrl: '' };
      const updated = await updateCandidateProfile({ userId: registered.user.id, role: 'CANDIDATE' }, input, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      expect(updated.firstName).toBe('Updated');
      expect(updated.profileCompletion).toBeGreaterThan(0);
      const persisted = await prisma.candidateProfile.findUnique({ where: { userId: registered.user.id }, select: { firstName: true, skills: true, profileCompletion: true } });
      expect(persisted?.firstName).toBe('Updated');
      expect(persisted?.skills).toEqual(['TypeScript', 'Next.js']);
      const user = await prisma.user.findUnique({ where: { id: registered.user.id }, select: { name: true, phone: true } });
      expect(user?.name).toBe('Updated Candidate');
      expect(user?.phone).toBe('+91 90000 00002');
      const audit = await prisma.auditLog.findFirst({ where: { actorUserId: registered.user.id, entityType: 'CandidateProfile', action: 'USER_UPDATED' }, orderBy: { createdAt: 'desc' } });
      expect(audit).not.toBeNull();
      await expect(updateCandidateProfile({ userId: registered.user.id, role: 'RECRUITER' }, input, { ipAddress: '127.0.0.1', userAgent: 'vitest' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    } finally {
      await removeUser(registered.user.id);
    }
  });
});