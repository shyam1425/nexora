import { logger } from './logger';

/**
 * Runs a read-only database query and reports failure instead of throwing.
 *
 * Public pages must not turn a dependency outage into an unexplained 500. The
 * caller renders an explicit "temporarily unavailable" state, while the failure
 * is still logged and `/api/v1/health` keeps returning 503, so monitoring is
 * unaffected by the friendlier rendering.
 */
export type QueryOutcome<T> = { ok: true; value: T } | { ok: false };

export async function queryOrUnavailable<T>(
  label: string,
  query: () => Promise<T>,
): Promise<QueryOutcome<T>> {
  try {
    return { ok: true, value: await query() };
  } catch (error) {
    logger.error(`${label}_unavailable`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}
