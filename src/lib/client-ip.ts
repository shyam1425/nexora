/**
 * Client address resolution.
 *
 * The application needs a client address for two security decisions: IP-scoped
 * rate-limit buckets and the `ipAddress` recorded on audit/login-attempt rows.
 * Both only hold up if the value cannot be chosen by the caller.
 *
 * `x-forwarded-for` / `x-real-ip` are ordinary request headers: any client can
 * send them. Next.js fills `x-forwarded-for` with the real socket address only
 * when the client sent nothing (`req.headers['x-forwarded-for'] ??= ...`), and a
 * client-supplied value is forwarded unchanged - so an inbound forwarding header
 * is never proof of an address on its own.
 *
 * Therefore:
 *
 * - Without an explicitly trusted proxy (`TRUST_PROXY` unset/false) no
 *   forwarding header is trusted at all; the address is reported as `unknown`.
 * - With exactly one trusted proxy (`TRUST_PROXY=true`) the *right-most*
 *   validated hop is used, because a proxy appends the address it observed to
 *   the right of whatever the client sent. Taking the left-most entry - the
 *   common mistake - would accept an attacker-supplied address.
 *
 * For multi-hop/CDN topologies configure the edge to overwrite rather than
 * append (`proxy_set_header X-Forwarded-For $remote_addr;`); see DEPLOYMENT.md.
 */

/** Returned when no address can be trusted. */
export const UNKNOWN_CLIENT_IP = 'unknown';

/** Longest legal textual IP address (`IPv6` full form). */
const MAX_IP_LENGTH = 45;

const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** One `a`-`f`/`0`-`9` group of at most four digits. */
const IPV6_GROUP_PATTERN = /^[0-9a-f]{1,4}$/;

/** True when `value` is a literal IPv4 address (no port, no brackets). */
export function isIpv4Address(value: string): boolean {
  return value.length <= MAX_IP_LENGTH && IPV4_PATTERN.test(value);
}

/**
 * True when `value` is a literal IPv6 address (no port, no brackets, no zone).
 *
 * Parsed rather than pattern-matched: a single regular expression that covers
 * `::` compression, full form, and a trailing embedded IPv4 address is easy to
 * get subtly wrong.
 */
export function isIpv6Address(value: string): boolean {
  if (value.length < 2 || value.length > MAX_IP_LENGTH) return false;

  // At most one `::` compression marker is allowed.
  const compressionStart = value.indexOf('::');
  if (compressionStart !== -1 && value.indexOf('::', compressionStart + 2) !== -1) return false;
  const compressed = compressionStart !== -1;

  // A trailing dotted-quad replaces the last two groups (e.g. `::ffff:10.0.0.1`).
  let text = value;
  let expectedGroups = 8;
  const lastColon = text.lastIndexOf(':');
  if (lastColon !== -1 && text.slice(lastColon + 1).includes('.')) {
    const tail = text.slice(lastColon + 1);
    if (!isIpv4Address(tail)) return false;
    expectedGroups = 6;
    text = text.slice(0, lastColon);
    if (text.endsWith(':')) text = text.slice(0, -1);
  }

  if (!compressed) {
    const groups = text.split(':');
    return groups.length === expectedGroups && groups.every((group) => IPV6_GROUP_PATTERN.test(group));
  }

  const [left, right = ''] = text.split('::');
  const leftGroups = left === '' ? [] : left.split(':');
  const rightGroups = right === '' ? [] : right.split(':');

  // `::` must stand for at least one omitted group.
  const groups = [...leftGroups, ...rightGroups];
  return (
    groups.length < expectedGroups && groups.every((group) => IPV6_GROUP_PATTERN.test(group))
  );
}

/** True when `value` is a literal IPv4 or IPv6 address (no port, no brackets). */
export function isIpAddress(value: string): boolean {
  return isIpv4Address(value) || isIpv6Address(value);
}

/**
 * Normalises a single forwarded hop into a canonical address, or `null` when the
 * value is not a usable address. Anything unparsable, oversized, or containing
 * separators/control characters is rejected so a hostile header can neither
 * invent an identity nor bloat rate-limit buckets or audit rows.
 */
export function normalizeIpAddress(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  let candidate = value.trim().toLowerCase();
  if (candidate.length === 0 || candidate.length > MAX_IP_LENGTH) return null;

  // Some proxies emit `[2001:db8::1]` or `203.0.113.7:443`.
  if (candidate.startsWith('[') && candidate.includes(']')) {
    candidate = candidate.slice(1, candidate.indexOf(']'));
  }
  if (!isIpAddress(candidate) && candidate.includes(':') && !candidate.includes('::')) {
    const host = candidate.slice(0, candidate.lastIndexOf(':'));
    if (isIpAddress(host) && !host.includes(':')) candidate = host;
  }

  if (!isIpAddress(candidate)) return null;

  // Collapse IPv4-mapped IPv6 (`::ffff:203.0.113.7`) so one client cannot hold
  // two identities depending on the listener's address family.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(candidate);
  if (mapped && isIpAddress(mapped[1])) return mapped[1];

  return candidate;
}

export type ClientIpInput = {
  /** Raw `x-forwarded-for` header value (comma-separated chain). */
  forwardedFor: string | null;
  /** Raw `x-real-ip` header value. */
  realIp: string | null;
  /** Whether the runtime sits behind exactly one trusted reverse proxy. */
  trustProxy: boolean;
};

/**
 * Resolves the caller address from forwarding headers.
 *
 * A caller-supplied header is attacker-controlled, so forwarded values are only
 * read when a proxy is explicitly trusted. See the module comment for the
 * right-most-hop rule.
 */
export function resolveClientIp(input: ClientIpInput): string {
  if (!input.trustProxy) return UNKNOWN_CLIENT_IP;

  const hops = (input.forwardedFor ?? '').split(',');
  for (let index = hops.length - 1; index >= 0; index -= 1) {
    const address = normalizeIpAddress(hops[index]);
    if (address) return address;
  }

  return normalizeIpAddress(input.realIp) ?? UNKNOWN_CLIENT_IP;
}
