import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `resolveS3Settings()` reads the validated environment, so each case stubs
 * `process.env` and re-imports the module graph to re-evaluate that environment.
 * The error class comes from the same fresh graph, because a reset registry
 * produces a new class identity.
 */
const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'mysql://workfox:secret@127.0.0.1:3306/workfox_tech',
  SESSION_SECRET: 'seed-secret-value-that-is-long-enough-for-validation',
  STORAGE_DRIVER: 's3',
  S3_BUCKET: 'workfox-private-docs',
  S3_REGION: 'eu-central-1',
  S3_ACCESS_KEY_ID: 'AKIAEXAMPLEKEYID000000',
  S3_SECRET_ACCESS_KEY: 'example-secret-access-key',
};

async function loadStorage(overrides: Record<string, string> = {}) {
  vi.resetModules();
  const merged = { ...BASE_ENV, ...overrides };
  for (const [key, value] of Object.entries(merged)) vi.stubEnv(key, value);
  for (const key of ['S3_ENDPOINT', 'S3_FORCE_PATH_STYLE', 'S3_SESSION_TOKEN']) {
    if (!(key in overrides)) vi.stubEnv(key, '');
  }

  const [storage, types] = await Promise.all([
    import('@/lib/storage/s3-storage'),
    import('@/lib/storage/types'),
  ]);

  return {
    resolveS3Settings: storage.resolveS3Settings,
    StorageNotConfiguredError: types.StorageNotConfiguredError,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveS3Settings', () => {
  it('defaults to virtual-hosted AWS addressing', async () => {
    const { resolveS3Settings } = await loadStorage();
    const settings = resolveS3Settings();

    expect(settings.host).toBe('workfox-private-docs.s3.eu-central-1.amazonaws.com');
    expect(settings.protocol).toBe('https:');
    expect(settings.forcePathStyle).toBe(false);
    expect(settings.bucket).toBe('workfox-private-docs');
  });

  it('resolves a custom endpoint in virtual-hosted style when explicitly asked', async () => {
    const { resolveS3Settings } = await loadStorage({
      S3_ENDPOINT: 'https://minio.internal:9000',
      S3_FORCE_PATH_STYLE: 'false',
    });
    const settings = resolveS3Settings();

    expect(settings.host).toBe('workfox-private-docs.minio.internal:9000');
    expect(settings.protocol).toBe('https:');
    expect(settings.forcePathStyle).toBe(false);
  });

  it('auto-selects path-style addressing for custom endpoints (MinIO/R2)', async () => {
    const { resolveS3Settings } = await loadStorage({ S3_ENDPOINT: 'https://minio.internal:9000' });
    const settings = resolveS3Settings();

    expect(settings.host).toBe('minio.internal:9000');
    expect(settings.forcePathStyle).toBe(true);
  });

  it('auto-selects path-style for AWS when it is explicitly forced', async () => {
    const { resolveS3Settings } = await loadStorage({ S3_FORCE_PATH_STYLE: 'true' });
    const settings = resolveS3Settings();

    expect(settings.host).toBe('s3.eu-central-1.amazonaws.com');
    expect(settings.forcePathStyle).toBe(true);
  });

  it('never silently falls back: missing credentials fail fast', async () => {
    const { resolveS3Settings, StorageNotConfiguredError } = await loadStorage({
      S3_ACCESS_KEY_ID: '',
      S3_SECRET_ACCESS_KEY: '',
    });

    expect(() => resolveS3Settings()).toThrow(StorageNotConfiguredError);
    expect(() => resolveS3Settings()).toThrow(/S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY/);
  });

  it('rejects a malformed endpoint', async () => {
    const { resolveS3Settings } = await loadStorage({ S3_ENDPOINT: 'not-a-url' });

    expect(() => resolveS3Settings()).toThrow(/S3_ENDPOINT must be an absolute http\(s\) URL/);
  });

  it('rejects a non-http endpoint protocol', async () => {
    const { resolveS3Settings } = await loadStorage({ S3_ENDPOINT: 'ftp://minio.internal' });

    expect(() => resolveS3Settings()).toThrow(/http or https protocol/);
  });

  it('rejects cleartext object storage in production', async () => {
    const { resolveS3Settings } = await loadStorage({
      NODE_ENV: 'production',
      S3_ENDPOINT: 'http://minio.internal:9000',
    });

    expect(() => resolveS3Settings()).toThrow(/must use https in production/);
  });

  it('carries the optional session token through', async () => {
    const { resolveS3Settings } = await loadStorage({ S3_SESSION_TOKEN: 'session-token-value' });

    expect(resolveS3Settings().sessionToken).toBe('session-token-value');
  });
});
