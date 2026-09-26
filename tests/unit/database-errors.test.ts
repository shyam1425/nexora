import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { routeHandler } from '@/lib/api';
import { isDatabaseUnavailable } from '@/lib/database-errors';
import { AppError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';

function request(path = '/api/v1/test'): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost'));
}

describe('isDatabaseUnavailable', () => {
  it('recognises the driver pool timeout observed in production', () => {
    const error = Object.assign(
      new Error('pool timeout: failed to retrieve a connection from pool after 10007ms'),
      { code: '45028' },
    );
    expect(isDatabaseUnavailable(error)).toBe(true);
  });

  it('recognises the Prisma transaction-start message', () => {
    expect(
      isDatabaseUnavailable(
        new Error('Transaction API error: Unable to start a transaction in the given time'),
      ),
    ).toBe(true);
  });

  it('recognises Prisma connection error codes', () => {
    for (const code of ['P1001', 'P1002', 'P2024', 'P1017']) {
      expect(isDatabaseUnavailable(Object.assign(new Error('wrapped'), { code }))).toBe(true);
    }
  });

  it('recognises socket-level codes and walks the cause chain', () => {
    const driver = Object.assign(new Error('getaddrinfo ENOTFOUND db.invalid'), {
      code: 'ENOTFOUND',
    });
    const wrapper = Object.assign(new Error('Invalid `prisma.job.findMany()` invocation'), {
      cause: driver,
    });
    expect(isDatabaseUnavailable(wrapper)).toBe(true);
  });

  it('does not classify request-level or unrelated failures as outages', () => {
    expect(
      isDatabaseUnavailable(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })),
    ).toBe(false);
    expect(isDatabaseUnavailable(new ValidationError('bad input'))).toBe(false);
    expect(isDatabaseUnavailable(new AppError('CONFLICT', 'conflict', 409))).toBe(false);
    expect(isDatabaseUnavailable(new Error('Something else broke'))).toBe(false);
    expect(isDatabaseUnavailable('plain string')).toBe(false);
    expect(isDatabaseUnavailable(undefined)).toBe(false);
    expect(isDatabaseUnavailable(null)).toBe(false);
  });
});

describe('routeHandler dependency-outage mapping', () => {
  it('answers 503 SERVICE_UNAVAILABLE when the database cannot be reached', async () => {
    const error = Object.assign(
      new Error('pool timeout: failed to retrieve a connection from pool after 10007ms'),
      { code: '45028' },
    );
    const handler = routeHandler<Record<string, never>>(async () => {
      throw error;
    });

    const response = await handler(request('/api/v1/auth/login'), {});

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service dependencies are unavailable',
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      'api_database_unavailable',
      expect.objectContaining({ path: '/api/v1/auth/login' }),
    );
    expect(logger.error).not.toHaveBeenCalledWith('Unhandled API error', expect.anything());
  });

  it('keeps unrelated exceptions as a sanitized 500', async () => {
    const handler = routeHandler<Record<string, never>>(async () => {
      throw new Error('secret internal detail: /srv/app/whatever');
    });

    const response = await handler(request(), {});
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('/srv/app/whatever');
  });

  it('still maps typed application errors to their own status', async () => {
    const handler = routeHandler<Record<string, never>>(async () => {
      throw new AppError('CSRF_ORIGIN_MISMATCH', 'Cross-origin request rejected', 403);
    });

    const response = await handler(request(), {});
    expect(response.status).toBe(403);
  });
});
