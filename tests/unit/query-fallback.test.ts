import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';
import { queryOrUnavailable } from '@/lib/query-fallback';

describe('queryOrUnavailable', () => {
  it('returns the resolved value when the query succeeds', async () => {
    const result = await queryOrUnavailable('careers_listing', async () => [1, 2, 3]);
    expect(result).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('reports failure and logs the cause instead of throwing', async () => {
    const result = await queryOrUnavailable('careers_listing', async () => {
      throw new Error('pool timeout: failed to retrieve a connection');
    });

    expect(result).toEqual({ ok: false });
    expect(logger.error).toHaveBeenCalledWith('careers_listing_unavailable', {
      error: 'pool timeout: failed to retrieve a connection',
    });
  });

  it('stringifies non-Error throwables so the log line stays structured', async () => {
    const result = await queryOrUnavailable('job_detail', async () => {
      throw 'connection lost';
    });

    expect(result).toEqual({ ok: false });
    expect(logger.error).toHaveBeenCalledWith('job_detail_unavailable', {
      error: 'connection lost',
    });
  });

  it('does not leak values into the outcome object', async () => {
    const result = await queryOrUnavailable('job_detail', async () => {
      throw new Error('boom');
    });

    expect(Object.keys(result)).toEqual(['ok']);
  });
});
