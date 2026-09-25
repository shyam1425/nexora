import { isProduction } from './env';

/**
 * Structured JSON logger.
 *
 * Never pass passwords, session tokens, secrets or raw document contents as
 * metadata: values are emitted verbatim to stdout for the platform log sink.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogMeta = Record<string, unknown>;

const REDACTED_KEYS = [
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'secret',
  'authorization',
  'cookie',
  'sessionToken',
];

function redact(meta: LogMeta): LogMeta {
  const clean: LogMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    if (REDACTED_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      clean[key] = '[redacted]';
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function emit(level: LogLevel, message: string, meta?: LogMeta): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? redact(meta) : {}),
  };

  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  if (level === 'debug' && isProduction) return;
  console.log(line);
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => emit('debug', message, meta),
  info: (message: string, meta?: LogMeta) => emit('info', message, meta),
  warn: (message: string, meta?: LogMeta) => emit('warn', message, meta),
  error: (message: string, meta?: LogMeta) => emit('error', message, meta),
};
