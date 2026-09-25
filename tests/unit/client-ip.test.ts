import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  UNKNOWN_CLIENT_IP,
  isIpAddress,
  normalizeIpAddress,
  resolveClientIp,
} from '@/lib/client-ip';
import { clientIp } from '@/lib/api';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isIpAddress', () => {
  it('accepts IPv4 literals', () => {
    for (const value of ['0.0.0.0', '10.0.0.1', '203.0.113.7', '255.255.255.255']) {
      expect(isIpAddress(value)).toBe(true);
    }
  });

  it('rejects malformed IPv4 literals', () => {
    for (const value of ['256.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4', '1.2.3.-4', '1.2.3.a']) {
      expect(isIpAddress(value)).toBe(false);
    }
  });

  it('accepts IPv6 literals in short, compressed, and full form', () => {
    for (const value of [
      '::1',
      '::',
      'fe80::1',
      '2001:db8::1',
      '2001:0db8:0000:0000:0000:0000:0000:0001',
    ]) {
      expect(isIpAddress(value)).toBe(true);
    }
  });

  it('rejects malformed IPv6 literals', () => {
    for (const value of ['12345::', '::1::2', 'fe80::1%eth0', 'gggg::1']) {
      expect(isIpAddress(value)).toBe(false);
    }
  });

  it('accepts an embedded IPv4 tail and the unspecified address', () => {
    expect(isIpAddress('::ffff:203.0.113.7')).toBe(true);
    expect(isIpAddress('::')).toBe(true);
  });

  it('rejects empty and non-address input', () => {
    for (const value of ['', 'unknown', 'not-an-ip', 'localhost', '1.1.1.1, 2.2.2.2']) {
      expect(isIpAddress(value)).toBe(false);
    }
  });
});

describe('normalizeIpAddress', () => {
  it('trims and lower-cases the address', () => {
    expect(normalizeIpAddress('  203.0.113.7\t')).toBe('203.0.113.7');
    expect(normalizeIpAddress('2001:DB8::1')).toBe('2001:db8::1');
  });

  it('unwraps bracketed IPv6 and strips an IPv4 port suffix', () => {
    expect(normalizeIpAddress('[2001:db8::1]')).toBe('2001:db8::1');
    expect(normalizeIpAddress('203.0.113.7:443')).toBe('203.0.113.7');
    expect(normalizeIpAddress('2001:db8::1')).toBe('2001:db8::1');
  });

  it('collapses IPv4-mapped IPv6 to one identity', () => {
    expect(normalizeIpAddress('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('rejects missing, oversized, and injected values', () => {
    expect(normalizeIpAddress(null)).toBeNull();
    expect(normalizeIpAddress(undefined)).toBeNull();
    expect(normalizeIpAddress('   ')).toBeNull();
    expect(normalizeIpAddress('9'.repeat(60))).toBeNull();
    // Header-splitting/CRLF injection and multi-entry chains are not addresses.
    expect(normalizeIpAddress('203.0.113.7\nX-Injected: 1')).toBeNull();
    expect(normalizeIpAddress('203.0.113.7,203.0.113.8')).toBeNull();
    expect(normalizeIpAddress('unknown')).toBeNull();
  });
});

describe('resolveClientIp', () => {
  it('never trusts forwarding headers by default', () => {
    expect(
      resolveClientIp({ forwardedFor: '9.9.9.9', realIp: '9.9.9.8', trustProxy: false }),
    ).toBe(UNKNOWN_CLIENT_IP);
    expect(resolveClientIp({ forwardedFor: null, realIp: null, trustProxy: false })).toBe(
      UNKNOWN_CLIENT_IP,
    );
  });

  it('uses the right-most hop so a client-supplied prefix cannot win', () => {
    expect(
      resolveClientIp({
        forwardedFor: '9.9.9.9, 203.0.113.7',
        realIp: null,
        trustProxy: true,
      }),
    ).toBe('203.0.113.7');
  });

  it('uses the right-most hop when several proxies are listed', () => {
    expect(
      resolveClientIp({
        forwardedFor: '198.51.100.4, 203.0.113.7, 10.0.0.1',
        realIp: null,
        trustProxy: true,
      }),
    ).toBe('10.0.0.1');
  });

  it('skips empty and unparsable hops', () => {
    expect(
      resolveClientIp({ forwardedFor: '203.0.113.7, ', realIp: null, trustProxy: true }),
    ).toBe('203.0.113.7');
    expect(
      resolveClientIp({ forwardedFor: 'spoofed, 198.51.100.4', realIp: null, trustProxy: true }),
    ).toBe('198.51.100.4');
  });

  it('falls back to x-real-ip and then to unknown', () => {
    expect(
      resolveClientIp({ forwardedFor: 'garbage', realIp: '198.51.100.4', trustProxy: true }),
    ).toBe('198.51.100.4');
    expect(
      resolveClientIp({ forwardedFor: 'garbage', realIp: 'also-garbage', trustProxy: true }),
    ).toBe(UNKNOWN_CLIENT_IP);
    expect(resolveClientIp({ forwardedFor: null, realIp: null, trustProxy: true })).toBe(
      UNKNOWN_CLIENT_IP,
    );
  });
});

describe('clientIp', () => {
  it('ignores client-supplied forwarding headers on an unproxied deployment', () => {
    const request = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      headers: { 'x-forwarded-for': '9.9.9.9', 'x-real-ip': '9.9.9.8' },
    });

    expect(clientIp(request)).toBe(UNKNOWN_CLIENT_IP);
  });

  it('reads the forwarded address when a proxy is explicitly trusted', async () => {
    vi.resetModules();
    vi.stubEnv('TRUST_PROXY', 'true');
    const api = await import('@/lib/api');
    vi.resetModules();

    const request = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.7' },
    });

    expect(api.clientIp(request)).toBe('203.0.113.7');
  });
});
