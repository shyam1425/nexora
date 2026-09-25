import type { User } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { AppError, ConflictError, UnauthorizedError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import {
  NOTIFICATION_TYPES,
  appLink,
  notify,
  notifyRoles,
  sendTransactionalEmail,
} from '@/lib/notifications/service';
import { createSession } from '@/lib/auth/session';
import { slugify } from '@/lib/utils';
import type { RegisterCandidateInput, RegisterClientInput } from '@/lib/validation/auth';
import { TOKEN_PURPOSES, consumeToken, issueToken } from './token-service';

export type RequestMeta = { ipAddress?: string; userAgent?: string };

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const VERIFICATION_TTL_MINUTES = 60 * 24;
const RESET_TTL_MINUTES = 60;

export type AuthResult = {
  user: Pick<User, 'id' | 'email' | 'role' | 'name' | 'status' | 'emailVerifiedAt'>;
  token: string;
  expiresAt: Date;
};

export type ClientAuthResult = AuthResult & { clientId: string };

async function assertEmailAvailable(email: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.deletedAt) {
    throw new ConflictError('An account with this email address already exists');
  }
}

async function sendVerificationEmail(user: User, firstName: string): Promise<void> {
  const rawToken = await issueToken(
    user.id,
    TOKEN_PURPOSES.EMAIL_VERIFICATION,
    VERIFICATION_TTL_MINUTES,
  );
  const link = appLink(`/verify-email?token=${encodeURIComponent(rawToken)}`);

  await notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.EMAIL_VERIFICATION,
    title: 'Verify your email address',
    body: 'Confirm your email address to unlock all platform features.',
    link: `/verify-email?token=${encodeURIComponent(rawToken)}`,
  });

  await sendTransactionalEmail({
    to: user.email,
    subject: 'Verify your NEXORA account',
    text:
      `Hi ${firstName},\n\n` +
      'Welcome to NEXORA. Confirm your email address to activate your account:\n' +
      `${link}\n\n` +
      'This link expires in 24 hours. If you did not create this account you can ignore this email.',
  });
}

export async function registerCandidate(
  input: RegisterCandidateInput,
  meta: RequestMeta,
): Promise<AuthResult> {
  await assertEmailAvailable(input.email);
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: 'CANDIDATE',
        status: 'ACTIVE',
        name: `${input.firstName} ${input.lastName}`.trim(),
        phone: input.phone || null,
      },
    });

    await tx.candidateProfile.create({
      data: {
        userId: created.id,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        skills: [],
      },
    });

    await recordAudit(
      {
        action: AUDIT_ACTIONS.USER_REGISTERED,
        entityType: 'User',
        entityId: created.id,
        actorUserId: created.id,
        actorRole: 'CANDIDATE',
        metadata: { email: created.email, role: 'CANDIDATE' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      tx,
    );

    return created;
  });

  await sendVerificationEmail(user, input.firstName);

  const session = await createSession(user.id, meta);
  return { user, token: session.token, expiresAt: session.expiresAt };
}

export async function registerClientAccount(
  input: RegisterClientInput,
  meta: RequestMeta,
): Promise<ClientAuthResult> {
  await assertEmailAvailable(input.email);
  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: 'CLIENT',
        status: 'ACTIVE',
        name: input.contactName,
        phone: input.phone || null,
      },
    });

    const baseCode = slugify(input.companyName).slice(0, 40) || 'client';
    let code = baseCode;
    let suffix = 1;
    while (await tx.client.findUnique({ where: { code }, select: { id: true } })) {
      suffix += 1;
      code = `${baseCode}-${suffix}`;
    }

    const client = await tx.client.create({
      data: {
        name: input.companyName,
        code,
        industry: input.industry || null,
        city: input.city || null,
        contactName: input.contactName,
        contactEmail: input.email,
        contactPhone: input.phone || null,
        status: 'ACTIVE',
        createdById: created.id,
      },
    });

    await tx.clientUser.create({
      data: {
        clientId: client.id,
        userId: created.id,
        isPrimary: true,
      },
    });

    await recordAudit(
      {
        action: AUDIT_ACTIONS.USER_REGISTERED,
        entityType: 'User',
        entityId: created.id,
        actorUserId: created.id,
        actorRole: 'CLIENT',
        metadata: { email: created.email, role: 'CLIENT', clientId: client.id },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      tx,
    );

    await recordAudit(
      {
        action: AUDIT_ACTIONS.CLIENT_CREATED,
        entityType: 'Client',
        entityId: client.id,
        actorUserId: created.id,
        actorRole: 'CLIENT',
        metadata: { name: client.name, code: client.code, selfRegistered: true },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      tx,
    );

    await notify(
      {
        userId: created.id,
        type: NOTIFICATION_TYPES.WELCOME,
        title: 'Welcome to NEXORA',
        body: 'Your company account is ready. Raise your first manpower requirement to start hiring.',
        link: '/client/requirements/new',
      },
      tx,
    );

    await notifyRoles(
      ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
      {
        type: 'CLIENT_REGISTERED',
        title: 'New client registered',
        body: `${input.companyName} created a company account.`,
        entityType: 'Client',
        entityId: client.id,
        link: `/admin/clients/${client.id}`,
      },
      tx,
    );

    return { user: created, clientId: client.id };
  });

  await sendVerificationEmail(result.user, input.contactName);

  const session = await createSession(result.user.id, meta);
  return {
    user: result.user,
    token: session.token,
    expiresAt: session.expiresAt,
    clientId: result.clientId,
  };
}

/**
 * Constant-time-ish comparison target: a valid bcrypt hash of a random value.
 * Comparing against it when the account does not exist keeps response timing
 * comparable and avoids leaking which emails are registered.
 */
const DUMMY_PASSWORD_HASH =
  '$2a$12$C6UzMDM.H6dfI/f/IKcEe.7ZBd4z1nCX8m9r3eVuvTB9zUnsz5SpK';

export async function authenticate(
  email: string,
  password: string,
  meta: RequestMeta,
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  const invalidCredentials = new UnauthorizedError('Invalid email or password');

  if (!user || user.deletedAt) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: 'User',
      metadata: { email, reason: 'NO_ACCOUNT' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw invalidCredentials;
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: 'User',
      entityId: user.id,
      actorUserId: user.id,
      actorRole: user.role,
      metadata: { reason: 'LOCKED' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw new AppError(
      'ACCOUNT_LOCKED',
      `Too many failed attempts. Your account is locked for ${minutes} more minute(s).`,
      423,
    );
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    const failedAttempts = user.failedLoginAttempts + 1;
    const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: failedAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
          : user.lockedUntil,
      },
    });
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: 'User',
      entityId: user.id,
      actorUserId: user.id,
      actorRole: user.role,
      metadata: { reason: 'BAD_PASSWORD', failedAttempts, locked: shouldLock },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw invalidCredentials;
  }

  if (!user.emailVerifiedAt) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: 'User',
      entityId: user.id,
      actorUserId: user.id,
      actorRole: user.role,
      metadata: { reason: 'EMAIL_NOT_VERIFIED' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw new AppError(
      'EMAIL_NOT_VERIFIED',
      'Verify your email address before signing in.',
      403,
    );
  }

  if (user.status === 'DISABLED') {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: 'User',
      entityId: user.id,
      actorUserId: user.id,
      actorRole: user.role,
      metadata: { reason: 'DISABLED' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw new AppError(
      'ACCOUNT_DISABLED',
      'This account has been disabled. Please contact your administrator.',
      403,
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.LOGIN_SUCCEEDED,
    entityType: 'User',
    entityId: user.id,
    actorUserId: user.id,
    actorRole: user.role,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const session = await createSession(user.id, meta);
  return { user, token: session.token, expiresAt: session.expiresAt };
}

export async function verifyEmail(rawToken: string, meta: RequestMeta): Promise<{ email: string }> {
  const userId = await consumeToken(rawToken, TOKEN_PURPOSES.EMAIL_VERIFICATION);
  if (!userId) {
    throw new AppError(
      'INVALID_TOKEN',
      'This verification link is invalid, expired, or has already been used.',
      400,
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
    select: { id: true, email: true, role: true },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.EMAIL_VERIFIED,
    entityType: 'User',
    entityId: user.id,
    actorUserId: user.id,
    actorRole: user.role,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  await notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.WELCOME,
    title: 'Email verified',
    body: 'Your email address is confirmed. You now have full access to your account.',
  });

  return { email: user.email };
}

export async function resendVerificationEmail(
  userId: string,
  meta: RequestMeta,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new AppError('NOT_FOUND', 'Account not found', 404);
  if (user.emailVerifiedAt) {
    throw new AppError('ALREADY_VERIFIED', 'This email address is already verified', 409);
  }

  await sendVerificationEmail(user, user.name ?? 'there');
  await recordAudit({
    action: AUDIT_ACTIONS.EMAIL_VERIFICATION_RESENT,
    entityType: 'User',
    entityId: user.id,
    actorUserId: user.id,
    actorRole: user.role,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/**
 * Always resolves without revealing whether the email exists (no account
 * enumeration); mail is only sent for real, active accounts.
 */
export async function requestPasswordReset(
  email: string,
  meta: RequestMeta,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt || user.status === 'DISABLED') return;

  const rawToken = await issueToken(
    user.id,
    TOKEN_PURPOSES.PASSWORD_RESET,
    RESET_TTL_MINUTES,
  );
  const link = appLink(`/reset-password?token=${encodeURIComponent(rawToken)}`);

  await notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.PASSWORD_RESET,
    title: 'Password reset requested',
    body: 'A password reset link was generated for your account.',
  });

  await sendTransactionalEmail({
    to: user.email,
    subject: 'Reset your NEXORA password',
    text:
      `Hi ${user.name ?? 'there'},\n\n` +
      `Use the link below to choose a new password. It expires in ${RESET_TTL_MINUTES} minutes:\n${link}\n\n` +
      'If you did not request this, you can safely ignore this email.',
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
    entityType: 'User',
    entityId: user.id,
    actorUserId: user.id,
    actorRole: user.role,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
  meta: RequestMeta,
): Promise<{ email: string }> {
  const userId = await consumeToken(rawToken, TOKEN_PURPOSES.PASSWORD_RESET);
  if (!userId) {
    throw new AppError(
      'INVALID_TOKEN',
      'This reset link is invalid, expired, or has already been used.',
      400,
    );
  }

  const passwordHash = await hashPassword(newPassword);

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        // Consuming the reset link proves control of the mailbox.
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true, role: true },
    });

    // A password reset must invalidate every existing session.
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordAudit(
      {
        action: AUDIT_ACTIONS.PASSWORD_CHANGED,
        entityType: 'User',
        entityId: updated.id,
        actorUserId: updated.id,
        actorRole: updated.role,
        metadata: { via: 'PASSWORD_RESET' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      tx,
    );

    await notify(
      {
        userId: updated.id,
        type: NOTIFICATION_TYPES.PASSWORD_RESET,
        title: 'Password changed',
        body: 'Your password was reset and all active sessions were signed out.',
      },
      tx,
    );

    return updated;
  });

  return { email: user.email };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  meta: RequestMeta,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new AppError('NOT_FOUND', 'Account not found', 404);

  const matches = await verifyPassword(currentPassword, user.passwordHash);
  if (!matches) {
    throw new AppError('INVALID_PASSWORD', 'Your current password is incorrect', 400);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAudit(
      {
        action: AUDIT_ACTIONS.PASSWORD_CHANGED,
        entityType: 'User',
        entityId: user.id,
        actorUserId: user.id,
        actorRole: user.role,
        metadata: { via: 'CHANGE_PASSWORD' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      tx,
    );
  });
}




