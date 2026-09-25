import { describe, expect, it } from 'vitest';
import {
  databaseAdapterConfig,
  normalizeCertificateAuthority,
  type DatabasePoolOptions,
} from '@/lib/database-config';

// A self-issued provider certificate is opaque to this code: only the PEM
// envelope matters, so no real key material is needed here.
const CERTIFICATE = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n';

describe('certificate authority normalisation', () => {
  it('accepts literal PEM text', () => {
    expect(normalizeCertificateAuthority(CERTIFICATE)).toBe(CERTIFICATE.trim());
  });

  it('accepts a base64-encoded PEM bundle', () => {
    const encoded = Buffer.from(CERTIFICATE, 'utf8').toString('base64');

    expect(normalizeCertificateAuthority(encoded)).toBe(CERTIFICATE.trim());
  });

  it('turns escaped newlines into real ones', () => {
    const escaped = CERTIFICATE.replace(/\n/g, '\\n');

    expect(normalizeCertificateAuthority(escaped)).toBe(CERTIFICATE.trim());
  });

  it('fails fast when the value is not a certificate', () => {
    expect(() => normalizeCertificateAuthority('not-a-certificate')).toThrow(
      /DATABASE_SSL_CA/,
    );
  });
});

describe('database adapter configuration', () => {
  it('passes the connection URL through untouched when no CA is configured', () => {
    const url = 'mysql://user:secret@db.internal:3306/nexora?ssl=true';

    expect(databaseAdapterConfig(url)).toBe(url);
  });

  it('unpacks the URL into driver options when a CA is configured', () => {
    const options = databaseAdapterConfig(
      'mysql://user:secret@db.internal:3307/nexora' +
        '?connectionLimit=5&connectTimeout=8000&socketTimeout=30000&allowPublicKeyRetrieval=true',
      CERTIFICATE,
    ) as DatabasePoolOptions;

    expect(options).toEqual({
      host: 'db.internal',
      port: 3307,
      user: 'user',
      password: 'secret',
      database: 'nexora',
      ssl: { ca: CERTIFICATE },
      connectionLimit: 5,
      connectTimeout: 8000,
      socketTimeout: 30000,
      allowPublicKeyRetrieval: true,
    });
  });

  it('defaults the port and omits pool options that are not configured', () => {
    const options = databaseAdapterConfig(
      'mysql://user:secret@db.internal/nexora',
      CERTIFICATE,
    ) as DatabasePoolOptions;

    expect(options.port).toBe(3306);
    expect(options.connectionLimit).toBeUndefined();
    expect(options.connectTimeout).toBeUndefined();
    expect(options.socketTimeout).toBeUndefined();
    expect(options.allowPublicKeyRetrieval).toBeUndefined();
  });

  it('decodes percent-encoded credentials', () => {
    const options = databaseAdapterConfig(
      'mysql://db%40user:p%40ss%2Fword@db.internal:3306/nexora',
      CERTIFICATE,
    ) as DatabasePoolOptions;

    expect(options.user).toBe('db@user');
    expect(options.password).toBe('p@ss/word');
  });

  it('keeps the driver options the connection URL already provides', () => {
    const options = databaseAdapterConfig(
      'mysql://user:secret@db.internal:3306/nexora?connectionLimit=3&prepareCacheLength=0',
      CERTIFICATE,
    ) as DatabasePoolOptions;

    expect(options.connectionLimit).toBe(3);
    expect(options.database).toBe('nexora');
  });
});
