import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { prisma } from '../prisma';
import { env } from '../env';
import { logger } from '../logger';

export const SESSION_COOKIE_NAME = 'workfox_session';

const SESSION_TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
const SESSION_COOKIE_SECURE = env.APP_URL.startsWith('https://');

export type SessionUser = {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'RECRUITER' | 'CLIENT' | 'CANDIDATE' | 'EMPLOYEE';
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  name: string | null;
  emailVerifiedAt: Date | null;
};

export type AuthContext = {
  user: SessionUser;
  sessionId: string;
  expiresAt: Date;
};

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Issues a new opaque session token (the raw token is only ever sent to the
 * browser; the database stores a SHA-256 hash so a DB leak cannot be replayed).
 */
export async function createSession(
  userId: string,
  meta: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    },
  });

  return { token, expiresAt };
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: SESSION_COOKIE_SECURE,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: SESSION_COOKIE_SECURE,
    path: '/',
    expires: new Date(0),
  });
}

/**
 * Resolves the current user from the session cookie.
 * Cached per request so repeated calls inside one render hit the DB once.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          name: true,
          emailVerifiedAt: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (!session.user || session.user.deletedAt) return null;
  if (session.user.status === 'DISABLED') return null;

  // Defence in depth: the hash we looked up must match the presented token.
  if (!safeEqualHex(session.tokenHash, tokenHash)) return null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      status: session.user.status,
      name: session.user.name,
      emailVerifiedAt: session.user.emailVerifiedAt,
    },
    sessionId: session.id,
    expiresAt: session.expiresAt,
  };
});

/** Revokes the current session (logout) and clears the cookie. */
export async function revokeCurrentSession(response: NextResponse): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session
      .updateMany({
        where: { tokenHash: hashSessionToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch((error) => {
        logger.warn('session_revoke_failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
  clearSessionCookie(response);
}

/** Housekeeping: remove sessions that expired or were revoked long ago. */
export async function purgeStaleSessions(olderThanMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }],
    },
  });
  return result.count;
}
