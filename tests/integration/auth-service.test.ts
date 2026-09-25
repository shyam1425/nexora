import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { authenticate, registerCandidate } from '@/lib/services/auth-service';

const createdUserIds: string[] = [];

async function removeTestUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { actorUserId: userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({ where: { userId } }),
    prisma.candidateProfile.deleteMany({ where: { userId } }),
    prisma.user.deleteMany({ where: { id: userId } }),
  ]);
}

afterAll(async () => {
  await Promise.all(createdUserIds.map((userId) => removeTestUser(userId)));
  await prisma.$disconnect();
});

describe('candidate authentication persistence', () => {
  it('registers, persists, logs in, and rejects duplicate accounts', async () => {
    const email = `candidate.integration.${randomUUID()}@example.com`;
    const password = 'StrongPass123';
    const registered = await registerCandidate(
      {
        firstName: 'Integration',
        lastName: 'Candidate',
        email,
        phone: '+91 90000 00001',
        password,
        confirmPassword: password,
        acceptTerms: true,
      },
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
    );
    createdUserIds.push(registered.user.id);

    const persisted = await prisma.user.findUnique({
      where: { id: registered.user.id },
      include: { candidateProfile: true, sessions: true },
    });
    expect(persisted?.email).toBe(email);
    expect(persisted?.candidateProfile?.firstName).toBe('Integration');
    expect(persisted?.sessions).toHaveLength(1);

    await expect(
      registerCandidate(
        {
          firstName: 'Duplicate',
          lastName: 'Candidate',
          email,
          phone: '',
          password,
          confirmPassword: password,
          acceptTerms: true,
        },
        { ipAddress: '127.0.0.1', userAgent: 'vitest' },
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await expect(
      authenticate(email, password, {
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

    // Model the mailbox-verification step before exercising the login path.
    await prisma.user.update({
      where: { id: registered.user.id },
      data: { emailVerifiedAt: new Date() },
    });

    const loggedIn = await authenticate(email, password, {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(loggedIn.user.id).toBe(registered.user.id);

    await expect(
      authenticate(email, 'WrongPass123', {
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    const auditCount = await prisma.auditLog.count({
      where: { actorUserId: registered.user.id, action: 'LOGIN_FAILED' },
    });
    expect(auditCount).toBeGreaterThanOrEqual(1);
  });
});
