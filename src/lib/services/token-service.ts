import { createHash, randomBytes } from 'node:crypto';
import { prisma, type PrismaTx } from '@/lib/prisma';

/**
 * One-time tokens for email verification and password reset.
 *
 * Only a SHA-256 hash of the token is stored, so a database leak cannot be used
 * to verify or take over accounts. Tokens are single-use and time bound.
 */
export const TOKEN_PURPOSES = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;

export type TokenPurpose = (typeof TOKEN_PURPOSES)[keyof typeof TOKEN_PURPOSES];

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

type Client = PrismaTx | typeof prisma;

/** Issues a fresh single-use token, invalidating any previous unused tokens. */
export async function issueToken(
  userId: string,
  purpose: TokenPurpose,
  ttlMinutes: number,
  client: Client = prisma,
): Promise<string> {
  const rawToken = randomBytes(32).toString('base64url');

  await client.verificationToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  await client.verificationToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  });

  return rawToken;
}

/**
 * Consumes a token, returning the owning user id.
 * Returns null for unknown, expired, or already used tokens.
 */
export async function consumeToken(
  rawToken: string,
  purpose: TokenPurpose,
  client: Client = prisma,
): Promise<string | null> {
  const record = await client.verificationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!record) return null;
  if (record.purpose !== purpose) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;

  const consumed = await client.verificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Concurrency safety: if another request consumed it first, fail closed.
  if (consumed.count !== 1) return null;

  return record.userId;
}
