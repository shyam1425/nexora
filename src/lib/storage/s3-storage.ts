import { env } from '@/lib/env';
import {
  assertSafeStorageKey,
  checksumOf,
  StorageNotConfiguredError,
  type StorageAdapter,
  type StoredObject,
} from './types';
import { encodeObjectKey, sha256Hex, signS3Request, type SignInput } from './s3-signing';

/**
 * S3-compatible private object storage.
 *
 * Works with AWS S3 and any S3-compatible gateway (MinIO, Cloudflare R2,
 * Wasabi, Backblaze B2). Requests are signed with SigV4 using Node's built-in
 * crypto, so the platform does not depend on the (large) AWS SDK.
 *
 * Objects are always private: no ACLs are sent, and reads happen only through
 * the authorised download API. Bucket versioning/encryption/lifecycle policies
 * are expected to be configured on the bucket itself (see DEPLOYMENT.md).
 */

const EMPTY_PAYLOAD_SHA256 = sha256Hex('');

export type S3Settings = {
  bucket: string;
  region: string;
  host: string;
  protocol: 'http:' | 'https:';
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

/**
 * Maps validated environment configuration onto concrete S3 request settings.
 * Exported so the addressing/security rules can be unit tested directly.
 */
export function resolveS3Settings(): S3Settings {
  const missing = [
    ['S3_BUCKET', env.S3_BUCKET],
    ['S3_REGION', env.S3_REGION],
    ['S3_ACCESS_KEY_ID', env.S3_ACCESS_KEY_ID],
    ['S3_SECRET_ACCESS_KEY', env.S3_SECRET_ACCESS_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new StorageNotConfiguredError(
      `STORAGE_DRIVER=s3 requires: ${missing.join(', ')}`,
    );
  }

  const bucket = env.S3_BUCKET as string;
  const region = env.S3_REGION as string;
  const isProduction = env.NODE_ENV === 'production';
  let protocol: 'http:' | 'https:' = 'https:';
  let forcePathStyle = env.S3_FORCE_PATH_STYLE === true;
  let host = `${bucket}.s3.${region}.amazonaws.com`;

  if (env.S3_ENDPOINT) {
    let url: URL;
    try {
      url = new URL(env.S3_ENDPOINT);
    } catch {
      throw new StorageNotConfiguredError(
        `S3_ENDPOINT must be an absolute http(s) URL (received "${env.S3_ENDPOINT}")`,
      );
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new StorageNotConfiguredError('S3_ENDPOINT must use the http or https protocol');
    }
    if (isProduction && url.protocol !== 'https:') {
      throw new StorageNotConfiguredError(
        'S3_ENDPOINT must use https in production; credentials would otherwise travel in clear text',
      );
    }
    protocol = url.protocol;
    // Self-hosted gateways (MinIO, R2, ...) default to path-style addressing
    // unless the operator explicitly disables it.
    if (env.S3_FORCE_PATH_STYLE === undefined) forcePathStyle = true;
    host = forcePathStyle ? url.host : `${bucket}.${url.host}`;
  } else if (forcePathStyle) {
    host = `s3.${region}.amazonaws.com`;
  }

  return {
    bucket,
    region,
    host,
    protocol,
    forcePathStyle,
    accessKeyId: env.S3_ACCESS_KEY_ID as string,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
    sessionToken: env.S3_SESSION_TOKEN,
  };
}

function isNotFound(status: number): boolean {
  return status === 404;
}

export class S3Storage implements StorageAdapter {
  readonly name = 's3';

  private readonly settings: S3Settings;

  constructor(settings?: S3Settings) {
    this.settings = settings ?? resolveS3Settings();
  }

  /** Encoded object path, including the bucket when using path-style URLs. */
  private objectPath(storageKey: string): string {
    assertSafeStorageKey(storageKey);
    const encodedKey = encodeObjectKey(storageKey);
    return this.settings.forcePathStyle
      ? `/${encodeObjectKey(this.settings.bucket)}/${encodedKey}`
      : `/${encodedKey}`;
  }

  private async send(
    method: SignInput['method'],
    storageKey: string,
    options: { body?: Buffer; contentType?: string } = {},
  ): Promise<Response> {
    const canonicalPath = this.objectPath(storageKey);
    const payloadHash = options.body ? sha256Hex(options.body) : EMPTY_PAYLOAD_SHA256;
    const extraHeaders: Record<string, string> = {};
    if (options.contentType) extraHeaders['content-type'] = options.contentType;

    const signed = signS3Request({
      method,
      canonicalPath,
      host: this.settings.host,
      headers: extraHeaders,
      payloadHash,
      timestamp: new Date(),
      region: this.settings.region,
      accessKeyId: this.settings.accessKeyId,
      secretAccessKey: this.settings.secretAccessKey,
      sessionToken: this.settings.sessionToken,
    });

    // `host` is a forbidden header in fetch/undici and is derived from the URL,
    // so it is intentionally not re-sent; the signature still covers it.
    const headers = Object.fromEntries(
      Object.entries(signed.headers).filter(([name]) => name !== 'host'),
    );

    const response = await fetch(`${this.settings.protocol}//${this.settings.host}${canonicalPath}`, {
      method,
      headers,
      body: options.body ? new Uint8Array(options.body) : undefined,
      cache: 'no-store',
    });

    if (!response.ok && !isNotFound(response.status)) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `S3 ${method} failed with HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      );
    }

    return response;
  }

  async put(storageKey: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    await this.send('PUT', storageKey, { body: data, contentType: mimeType });
    return { storageKey, sizeBytes: data.byteLength, checksum: checksumOf(data), mimeType };
  }

  async get(storageKey: string): Promise<Buffer> {
    const response = await this.send('GET', storageKey);
    if (isNotFound(response.status)) throw new Error(`S3 object not found: ${storageKey}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(storageKey: string): Promise<void> {
    // S3 DELETE is idempotent: removing a missing object still returns 204.
    await this.send('DELETE', storageKey);
  }

  async exists(storageKey: string): Promise<boolean> {
    const response = await this.send('HEAD', storageKey);
    return !isNotFound(response.status);
  }
}
