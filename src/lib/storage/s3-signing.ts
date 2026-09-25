import { createHash, createHmac } from 'node:crypto';

/**
 * Minimal, dependency-free AWS Signature Version 4 signer for S3 requests.
 *
 * The application deliberately does not pull in the full AWS SDK: the private
 * document store only needs object PUT/GET/HEAD/DELETE, and Node's built-in
 * `crypto` plus global `fetch` are sufficient. Keeping the signer isolated here
 * makes it directly unit-testable against the published AWS test vectors.
 */

const SERVICE = 's3';
const ALGORITHM = 'AWS4-HMAC-SHA256';

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/** RFC 3986 encoding: only A-Z a-z 0-9 - _ . ~ stay unencoded. */
export function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Encodes an object key for use in a URL/canonical request, preserving the
 * path separator so nested prefixes stay nested.
 */
export function encodeObjectKey(objectKey: string): string {
  return objectKey.split('/').map(encodeRfc3986).join('/');
}

/** `20130524T000000Z` */
export function amzDate(timestamp: Date): string {
  return timestamp.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

export type SignInput = {
  method: 'GET' | 'HEAD' | 'PUT' | 'DELETE';
  /** Already RFC 3986 encoded path starting with `/`. */
  canonicalPath: string;
  host: string;
  /** Extra headers to sign, keyed by lowercase header name. */
  headers: Record<string, string>;
  /** Hex SHA-256 of the request body, or `UNSIGNED-PAYLOAD`. */
  payloadHash: string;
  timestamp: Date;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type SignedRequest = {
  /** Headers to send, including `authorization`. */
  headers: Record<string, string>;
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
};

function signingKey(secretAccessKey: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

/**
 * Produces the SigV4 `Authorization` header (and the supporting
 * `x-amz-date` / `host` headers) for a single S3 request.
 */
export function signS3Request(input: SignInput): SignedRequest {
  const date = input.timestamp.toISOString().slice(0, 10).replace(/-/g, '');
  const dateTime = amzDate(input.timestamp);

  const signable: Record<string, string> = {
    host: input.host,
    'x-amz-content-sha256': input.payloadHash,
    'x-amz-date': dateTime,
  };
  for (const [name, value] of Object.entries(input.headers)) {
    signable[name.toLowerCase()] = value;
  }
  if (input.sessionToken) signable['x-amz-security-token'] = input.sessionToken;

  const headerNames = Object.keys(signable).sort();
  const canonicalHeaders = headerNames
    .map((name) => `${name}:${signable[name].trim()}\n`)
    .join('');
  const signedHeaders = headerNames.join(';');

  const canonicalRequest = [
    input.method,
    input.canonicalPath,
    '', // canonical query string (no query parameters are used)
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join('\n');

  const scope = `${date}/${input.region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    dateTime,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = createHmac('sha256', signingKey(input.secretAccessKey, date, input.region))
    .update(stringToSign, 'utf8')
    .digest('hex');

  return {
    headers: {
      ...signable,
      authorization:
        `${ALGORITHM} Credential=${input.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    canonicalRequest,
    stringToSign,
    signature,
  };
}
