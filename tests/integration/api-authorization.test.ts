import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Role } from '@/generated/prisma/enums';
import { env } from '@/lib/env';

const authState = vi.hoisted(() => ({
  context: null as {
    user: {
      id: string;
      email: string;
      role: Role;
      status: 'ACTIVE';
      name: string | null;
      emailVerifiedAt: Date;
    };
    sessionId: string;
    expiresAt: Date;
  } | null,
}));

vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session')>();
  return {
    ...actual,
    getAuthContext: vi.fn(async () => authState.context),
  };
});

import { POST as createInterview } from '@/app/api/v1/interviews/route';
import { POST as createOffer } from '@/app/api/v1/offers/route';
import { PATCH as completeJoining } from '@/app/api/v1/joinings/[id]/complete/route';
import { POST as createSubmission } from '@/app/api/v1/submissions/route';
import { POST as respondToOffer } from '@/app/api/v1/offers/[id]/respond/route';
import { POST as createJob } from '@/app/api/v1/jobs/route';
import { PATCH as updateCandidateProfile } from '@/app/api/v1/candidate/profile/route';

function contextFor(role: Role) {
  return {
    user: {
      id: `test-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@example.com`,
      role,
      status: 'ACTIVE' as const,
      name: 'Authorization Test',
      emailVerifiedAt: new Date(),
    },
    sessionId: `session-${role.toLowerCase()}`,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

function request(path: string, method: 'POST' | 'PATCH' = 'POST', body: Record<string, unknown> = {}) {
  const origin = new URL(env.APP_URL).origin;
  return new NextRequest(`${origin}${path}`, {
    method,
    headers: {
      origin,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function expectError(
  response: Response,
  status: number,
  code: string,
): Promise<void> {
  expect(response.status).toBe(status);
  const body = (await response.json()) as { error?: { code?: string } };
  expect(body.error?.code).toBe(code);
}

describe('recruitment API authorization boundaries', () => {
  beforeEach(() => {
    authState.context = null;
  });

  it('rejects protected workflow routes without a session', async () => {
    const response = await createInterview(request('/api/v1/interviews'), { params: Promise.resolve({}) });
    await expectError(response, 401, 'UNAUTHENTICATED');
  });

  it('rejects candidate calls to staff-only workflow routes', async () => {
    authState.context = contextFor('CANDIDATE');

    await expectError(
      await createInterview(request('/api/v1/interviews'), { params: Promise.resolve({}) }),
      403,
      'FORBIDDEN',
    );
    await expectError(
      await createOffer(request('/api/v1/offers'), { params: Promise.resolve({}) }),
      403,
      'FORBIDDEN',
    );
    await expectError(
      await createSubmission(request('/api/v1/submissions'), { params: Promise.resolve({}) }),
      403,
      'FORBIDDEN',
    );
    await expectError(
      await createJob(request('/api/v1/jobs'), { params: Promise.resolve({}) }),
      403,
      'FORBIDDEN',
    );
  });

  it('rejects a recruiter from using the candidate-only offer response route', async () => {
    authState.context = contextFor('RECRUITER');

    await expectError(
      await respondToOffer(
        request('/api/v1/offers/test-offer/respond', 'POST', { decision: 'ACCEPT' }),
        { params: Promise.resolve({ id: 'test-offer' }) },
      ),
      403,
      'FORBIDDEN',
    );
  });

  it('rejects a client from completing a joining record', async () => {
    authState.context = contextFor('CLIENT');

    await expectError(
      await completeJoining(
        request('/api/v1/joinings/test-joining/complete', 'PATCH', { actualJoiningDate: new Date().toISOString() }),
        { params: Promise.resolve({ id: 'test-joining' }) },
      ),
      403,
      'FORBIDDEN',
    );
  });

  it('rejects non-candidate calls to the candidate profile update route', async () => {
    authState.context = contextFor('RECRUITER');

    await expectError(
      await updateCandidateProfile(
        request('/api/v1/candidate/profile', 'PATCH', { firstName: 'Recruiter', lastName: 'Attempt', phone: '' }),
        { params: Promise.resolve({}) },
      ),
      403,
      'FORBIDDEN',
    );
  });
});
