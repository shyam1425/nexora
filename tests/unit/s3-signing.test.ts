import { describe, expect, it } from 'vitest';
import { amzDate, encodeObjectKey, encodeRfc3986, sha256Hex, signS3Request } from '@/lib/storage/s3-signing';

/**
 * Reference vectors published by AWS in
 * https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sig-v4-header-based-auth.html
 * ("Examples: Signature Calculations"). These example credentials are public
 * documentation values, not real secrets.
 */
const ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
const SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
const REGION = 'us-east-1';
const SIGNING_TIME = new Date('2013-05-24T00:00:00.000Z');
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('SigV4 signing helpers', () => {
  it('formats the x-amz-date timestamp as UTC basic ISO 8601', () => {
    expect(amzDate(SIGNING_TIME)).toBe('20130524T000000Z');
    expect(amzDate(new Date('2024-01-15T12:34:56.000Z'))).toBe('20240115T123456Z');
  });

  it('encodes object keys per RFC 3986 while preserving path separators', () => {
    expect(encodeRfc3986('test$file.text')).toBe('test%24file.text');
    expect(encodeRfc3986("a b'c!d*e(f)")).toBe('a%20b%27c%21d%2Ae%28f%29');
    expect(encodeObjectKey('cm1234/2026/07/resume.pdf')).toBe('cm1234/2026/07/resume.pdf');
    expect(encodeObjectKey('dir with space/a+b.txt')).toBe('dir%20with%20space/a%2Bb.txt');
  });

  it('hashes the empty payload to the documented SHA-256 value', () => {
    expect(sha256Hex('')).toBe(EMPTY_SHA256);
  });
});

describe('signS3Request against the AWS reference test suite', () => {
  it('reproduces the GET Object vector (examplebucket/test.txt with Range)', () => {
    const signed = signS3Request({
      method: 'GET',
      canonicalPath: '/test.txt',
      host: 'examplebucket.s3.amazonaws.com',
      headers: { range: 'bytes=0-9' },
      payloadHash: EMPTY_SHA256,
      timestamp: SIGNING_TIME,
      region: REGION,
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    });

    expect(signed.canonicalRequest).toBe(
      [
        'GET',
        '/test.txt',
        '',
        'host:examplebucket.s3.amazonaws.com',
        'range:bytes=0-9',
        `x-amz-content-sha256:${EMPTY_SHA256}`,
        'x-amz-date:20130524T000000Z',
        '',
        'host;range;x-amz-content-sha256;x-amz-date',
        EMPTY_SHA256,
      ].join('\n'),
    );
    expect(signed.signature).toBe(
      'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
    expect(signed.headers.authorization).toBe(
      'AWS4-HMAC-SHA256 ' +
        `Credential=${ACCESS_KEY_ID}/20130524/us-east-1/s3/aws4_request, ` +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  it('reproduces the PUT Object vector (examplebucket/test$file.text with a body)', () => {
    const body = Buffer.from('Welcome to Amazon S3.', 'utf8');
    const signed = signS3Request({
      method: 'PUT',
      canonicalPath: '/test%24file.text',
      host: 'examplebucket.s3.amazonaws.com',
      headers: {
        Date: 'Fri, 24 May 2013 00:00:00 GMT',
        'x-amz-storage-class': 'REDUCED_REDUNDANCY',
      },
      payloadHash: sha256Hex(body),
      timestamp: SIGNING_TIME,
      region: REGION,
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    });

    expect(signed.signature).toBe(
      '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd',
    );
    // Header names are lowercased and sorted before signing.
    expect(signed.headers.authorization).toContain(
      'SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class',
    );
  });

  it('signs temporary credentials by including the session token header', () => {
    const signed = signS3Request({
      method: 'HEAD',
      canonicalPath: '/examplebucket/key.pdf',
      host: 'examplebucket.s3.amazonaws.com',
      headers: {},
      payloadHash: EMPTY_SHA256,
      timestamp: SIGNING_TIME,
      region: REGION,
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
      sessionToken: 'SESSION_TOKEN_VALUE',
    });

    expect(signed.headers['x-amz-security-token']).toBe('SESSION_TOKEN_VALUE');
    expect(signed.headers.authorization).toContain('x-amz-security-token');
    expect(signed.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a different signature when the payload changes', () => {
    const base = {
      method: 'PUT' as const,
      canonicalPath: '/examplebucket/key.pdf',
      host: 'examplebucket.s3.amazonaws.com',
      headers: { 'content-type': 'application/pdf' },
      timestamp: SIGNING_TIME,
      region: REGION,
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    };
    const first = signS3Request({ ...base, payloadHash: sha256Hex(Buffer.from('one')) });
    const second = signS3Request({ ...base, payloadHash: sha256Hex(Buffer.from('two')) });

    expect(first.signature).not.toBe(second.signature);
  });
});
