import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { S3Storage, type S3Settings } from '@/lib/storage/s3-storage';
import { generateStorageKey } from '@/lib/storage/types';

/**
 * The S3 adapter is exercised against a real HTTP endpoint that implements the
 * subset of the S3 object API the platform uses (PUT/GET/HEAD/DELETE with
 * path-style addressing). Live AWS/MinIO verification still requires operator
 * credentials, but request framing, addressing, signing coverage, payload
 * integrity, and 404/403 handling are all verified here over a real socket.
 */

const BUCKET = 'workfox-private-docs';

type Hit = {
  method: string;
  url: string;
  path: string;
  authorization: string;
  contentSha256: string;
  contentType?: string;
  acl?: string;
  body: Buffer;
};

const objects = new Map<string, Buffer>();
const hits: Hit[] = [];

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function signedHeaderNames(authorization: string): string[] {
  const match = /SignedHeaders=([^,]+)/.exec(authorization);
  return match ? match[1].split(';') : [];
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

let server: Server;
let settings: S3Settings;

beforeAll(async () => {
  server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const body = await readBody(request);
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    hits.push({
      method: request.method ?? '',
      url: request.url ?? '',
      path: url.pathname,
      authorization: String(request.headers.authorization ?? ''),
      contentSha256: String(request.headers['x-amz-content-sha256'] ?? ''),
      contentType: request.headers['content-type'] as string | undefined,
      acl: request.headers['x-amz-acl'] as string | undefined,
      body,
    });

    // Emulate a gateway rejecting the request with a non-404 error status.
    if (url.pathname.startsWith(`/${BUCKET}/denied/`)) {
      response.writeHead(403, { 'content-type': 'application/xml' });
      response.end('<Error><Code>AccessDenied</Code></Error>');
      return;
    }

    const objectKey = url.pathname.slice(`/${BUCKET}/`.length);

    if (request.method === 'PUT') {
      objects.set(objectKey, body);
      response.writeHead(200, { etag: `"${sha256(body)}"` });
      response.end();
      return;
    }
    if (request.method === 'GET') {
      const stored = objects.get(objectKey);
      if (!stored) {
        response.writeHead(404, { 'content-type': 'application/xml' });
        response.end('<Error><Code>NoSuchKey</Code></Error>');
        return;
      }
      response.writeHead(200, { 'content-length': String(stored.byteLength) });
      response.end(stored);
      return;
    }
    if (request.method === 'HEAD') {
      const stored = objects.get(objectKey);
      response.writeHead(stored ? 200 : 404, { 'content-length': String(stored?.byteLength ?? 0) });
      response.end();
      return;
    }
    if (request.method === 'DELETE') {
      objects.delete(objectKey);
      response.writeHead(204);
      response.end();
      return;
    }

    response.writeHead(405);
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  settings = {
    bucket: BUCKET,
    region: 'us-east-1',
    host: `127.0.0.1:${port}`,
    protocol: 'http:',
    forcePathStyle: true,
    accessKeyId: 'AKIAEXAMPLEKEYID000000',
    secretAccessKey: 'example-secret-access-key',
  };
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});


describe('S3Storage over HTTP', () => {
  it('PUTs a signed, private object and reports size plus checksum', async () => {
    const storage = new S3Storage(settings);
    const key = generateStorageKey('user-123', 'resume.pdf');
    const data = Buffer.from('%PDF-1.4\nobject storage test');
    hits.length = 0;

    const stored = await storage.put(key, data, 'application/pdf');

    expect(stored).toEqual({
      storageKey: key,
      sizeBytes: data.byteLength,
      checksum: sha256(data),
      mimeType: 'application/pdf',
    });
    expect(hits).toHaveLength(1);

    const [hit] = hits;
    expect(hit.method).toBe('PUT');
    // Path-style addressing keeps the bucket in the URL, and no query string is used.
    expect(hit.path).toBe(`/${BUCKET}/${key}`);
    expect(hit.url).not.toContain('?');
    // Objects stay private: no canned ACL is ever sent.
    expect(hit.acl).toBeUndefined();
    expect(hit.contentType).toBe('application/pdf');
    // The declared payload hash matches the bytes that actually arrived.
    expect(hit.contentSha256).toBe(sha256(hit.body));
    // The request is authentically signed with the expected credential scope.
    expect(hit.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLEKEYID000000\/\d{8}\/us-east-1\/s3\/aws4_request,/,
    );
    expect(hit.authorization).toMatch(/Signature=[0-9a-f]{64}$/);
    expect(signedHeaderNames(hit.authorization)).toEqual([
      'content-type',
      'host',
      'x-amz-content-sha256',
      'x-amz-date',
    ]);
  });

  it('round-trips the exact bytes through GET', async () => {
    const storage = new S3Storage(settings);
    const key = generateStorageKey('user-123', 'contract.docx');
    const data = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02, 0xff]);

    await storage.put(
      key,
      data,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    const downloaded = await storage.get(key);

    expect(Buffer.compare(downloaded, data)).toBe(0);
    const last = hits[hits.length - 1];
    expect(last.method).toBe('GET');
    expect(signedHeaderNames(last.authorization)).toEqual([
      'host',
      'x-amz-content-sha256',
      'x-amz-date',
    ]);
  });

  it('reports existence, deletes idempotently, and treats 404 as absent', async () => {
    const storage = new S3Storage(settings);
    const key = generateStorageKey('user-456', 'id-proof.pdf');

    expect(await storage.exists(key)).toBe(false);
    await storage.put(key, Buffer.from('%PDF-1.7\nid proof'), 'application/pdf');
    expect(await storage.exists(key)).toBe(true);

    const head = hits[hits.length - 1];
    expect(head.method).toBe('HEAD');
    expect(head.path).toBe(`/${BUCKET}/${key}`);

    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
    await expect(storage.get(key)).rejects.toThrow(/not found/i);

    // Deleting an object that no longer exists must not throw.
    await expect(storage.delete(key)).resolves.toBeUndefined();
    expect(objects.has(key)).toBe(false);
  });

  it('surfaces non-404 gateway failures instead of swallowing them', async () => {
    const storage = new S3Storage(settings);

    await expect(
      storage.put('denied/secret.pdf', Buffer.from('%PDF-1.4'), 'application/pdf'),
    ).rejects.toThrow(/S3 PUT failed with HTTP 403/);
    await expect(storage.exists('denied/secret.pdf')).rejects.toThrow(/HTTP 403/);
  });

  it('refuses path-traversal keys before any request is sent', async () => {
    const storage = new S3Storage(settings);
    hits.length = 0;

    await expect(
      storage.put('../../etc/passwd', Buffer.from('x'), 'application/pdf'),
    ).rejects.toThrow(/Unsafe storage key/);
    await expect(storage.get('C:\\secrets\\key.pdf')).rejects.toThrow(/Unsafe storage key/);
    await expect(storage.exists('nested\\escape.pdf')).rejects.toThrow(/Unsafe storage key/);
    expect(hits).toHaveLength(0);
  });

  it('targets virtual-hosted buckets with a key-only path when path style is off', async () => {
    const storage = new S3Storage({ ...settings, forcePathStyle: false });
    const key = generateStorageKey('user-789', 'photo.pdf');
    hits.length = 0;

    await storage.put(key, Buffer.from('%PDF-1.4\nvirtual hosted'), 'application/pdf');

    expect(hits[0].path).toBe(`/${key}`);
    expect(hits[0].path.startsWith(`/${BUCKET}/`)).toBe(false);
    expect(hits[0].authorization).toContain('Credential=AKIAEXAMPLEKEYID000000/');
  });
});
