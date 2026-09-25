/**
 * Database connection configuration.
 *
 * Kept separate from the Prisma client wiring so that the connection-URL and
 * certificate handling can be unit-tested without opening a connection pool.
 */

/** Options the MariaDB driver accepts for the pool it owns. */
export type DatabasePoolOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: { ca: string };
  connectionLimit?: number;
  connectTimeout?: number;
  socketTimeout?: number;
  allowPublicKeyRetrieval?: boolean;
};

/**
 * Accepts a certificate authority as literal PEM text or as its base64 encoding,
 * and tolerates escaped newlines so the value survives a single-line environment
 * variable. Anything else fails fast and loudly, matching `src/lib/env.ts`.
 */
export function normalizeCertificateAuthority(value: string): string {
  const decoded = value.includes('-----BEGIN')
    ? value
    : Buffer.from(value, 'base64').toString('utf8');
  const certificate = decoded.replace(/\\n/g, '\n').trim();

  if (!certificate.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error(
      'Invalid environment configuration:\n' +
        '  - DATABASE_SSL_CA: expected a PEM certificate or its base64 encoding',
    );
  }

  return certificate;
}

/**
 * Connection settings for the Prisma MariaDB adapter.
 *
 * A provider with a publicly-trusted certificate needs nothing beyond
 * `DATABASE_URL` (`?ssl=true`), and the URL string is then passed through
 * untouched. A provider that signs with its own certificate authority — a
 * default Aiven service, for example — cannot be trusted that way, because the
 * driver only accepts a CA bundle as part of an options object. When
 * `DATABASE_SSL_CA` is set the URL is unpacked into that object and the CA is
 * applied to it, so certificate verification stays enabled.
 */
export function databaseAdapterConfig(
  url: string,
  certificateAuthority?: string,
): string | DatabasePoolOptions {
  if (!certificateAuthority) return url;

  const parsed = new URL(url);
  const decode = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const numeric = (name: string): number | undefined => {
    const value = parsed.searchParams.get(name);
    return value === null || value.trim() === '' ? undefined : Number(value);
  };

  return {
    host: parsed.hostname,
    port: parsed.port === '' ? 3306 : Number(parsed.port),
    user: decode(parsed.username),
    password: decode(parsed.password),
    database: decode(parsed.pathname.replace(/^\//, '')),
    ssl: { ca: certificateAuthority },
    connectionLimit: numeric('connectionLimit'),
    connectTimeout: numeric('connectTimeout'),
    socketTimeout: numeric('socketTimeout'),
    allowPublicKeyRetrieval:
      parsed.searchParams.get('allowPublicKeyRetrieval') === 'true' ? true : undefined,
  };
}
