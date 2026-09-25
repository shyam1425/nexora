import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { getDocumentForAccess } from '@/lib/services/document-access-service';
import { uploadDocument } from '@/lib/services/document-service';
import { registerCandidate } from '@/lib/services/auth-service';

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

describe('private document storage', () => {
  it('validates, stores, and authorizes a candidate resume', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `candidate.document.${suffix}@example.com`;
    const otherEmail = `candidate.other.${suffix}@example.com`;
    const password = 'StrongPass123';
    const owner = await registerCandidate({ firstName: 'Document', lastName: 'Owner', email, phone: '', password, confirmPassword: password, acceptTerms: true }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
    const other = await registerCandidate({ firstName: 'Other', lastName: 'Candidate', email: otherEmail, phone: '', password, confirmPassword: password, acceptTerms: true }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
    let storageKey: string | undefined;
    try {
      const document = await uploadDocument({ userId: owner.user.id, role: 'CANDIDATE' }, { category: 'RESUME', candidateProfileId: '', employeeId: '', applicationId: '' }, { originalName: 'resume.pdf', mimeType: 'application/pdf', data: Buffer.from('%PDF-1.4\nresume test') }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      const stored = await prisma.document.findUnique({ where: { id: document.id }, select: { storageKey: true, candidateProfileId: true } });
      expect(stored?.candidateProfileId).toBeTruthy();
      storageKey = stored?.storageKey;
      await expect(getDocumentForAccess(document.id, { userId: owner.user.id, role: 'CANDIDATE' }, { ipAddress: '127.0.0.1' })).resolves.toBeTruthy();
      await expect(getDocumentForAccess(document.id, { userId: other.user.id, role: 'CANDIDATE' }, { ipAddress: '127.0.0.1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    } finally {
      if (storageKey) await getStorage().delete(storageKey).catch(() => undefined);
      await prisma.document.deleteMany({ where: { candidateProfile: { userId: { in: [owner.user.id, other.user.id] } } } });
      await removeUser(owner.user.id);
      await removeUser(other.user.id);
    }
  });
});
