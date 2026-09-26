/**
 * Recognises failures that mean "the database could not be reached" rather than
 * "this request was wrong", so the API layer can answer 503 (retryable)
 * instead of a misleading 500.
 *
 * Signatures observed in production with `@prisma/adapter-mariadb`: the
 * driver's pool timeout (errno `45028`) and the Prisma wrapper codes it surfaces
 * as `P1001`, `P1002`, `P1008`, `P1017` and `P2024`.
 */
const UNAVAILABLE_CODES = new Set([
  '45028', // mariadb: pool timeout
  'P1001', // Prisma: cannot reach the database server
  'P1002', // Prisma: the database server timed out
  'P1008', // Prisma: the operation timed out
  'P1017', // Prisma: the server closed the connection
  'P2024', // Prisma: timed out fetching a connection from the pool
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

const UNAVAILABLE_MESSAGES = [
  'pool timeout',
  'unable to start a transaction in the given time',
  "can't reach database server",
  'timed out fetching a new connection from the connection pool',
];

/** Walks an error and its `cause` chain, which is how Prisma nests driver errors. */
function errorChain(error: unknown): Array<{ code?: unknown; message?: unknown }> {
  const values: Array<{ code?: unknown; message?: unknown }> = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const value = current as { code?: unknown; message?: unknown; cause?: unknown };
    values.push(value);
    current = value.cause;
  }
  return values;
}

export function isDatabaseUnavailable(error: unknown): boolean {
  for (const value of errorChain(error)) {
    if (typeof value.code === 'string' && UNAVAILABLE_CODES.has(value.code)) return true;
    if (typeof value.message === 'string') {
      const message = value.message.toLowerCase();
      if (UNAVAILABLE_MESSAGES.some((needle) => message.includes(needle))) return true;
    }
  }
  return false;
}
