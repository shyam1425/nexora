import type { NextRequest } from 'next/server';
import {
  assertSameOrigin,
  clientIp,
  ok,
  parseJsonBody,
  routeHandler,
  userAgent,
} from '@/lib/api';
import { env } from '@/lib/env';
import { enforceRateLimit } from '@/lib/rate-limit';
import { dashboardPathForRole } from '@/lib/auth/rbac';
import { setSessionCookie } from '@/lib/auth/session';
import { authenticate } from '@/lib/services/auth-service';
import { loginSchema } from '@/lib/validation/auth';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const ip = clientIp(request);
  const body = await parseJsonBody(request, loginSchema);

  // Two buckets: per-IP (broad) and per-account (targeted credential stuffing).
  enforceRateLimit(
    `login:ip:${ip}`,
    env.AUTH_RATE_LIMIT_MAX * 3,
    env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
  );
  enforceRateLimit(
    `login:account:${body.email}`,
    env.AUTH_RATE_LIMIT_MAX,
    env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
  );

  const result = await authenticate(body.email, body.password, {
    ipAddress: ip,
    userAgent: userAgent(request),
  });

  const redirectTo =
    body.redirectTo &&
    body.redirectTo.startsWith('/') &&
    !body.redirectTo.startsWith('//')
      ? body.redirectTo
      : dashboardPathForRole(result.user.role);

  const response = ok({
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      emailVerified: Boolean(result.user.emailVerifiedAt),
    },
    redirectTo,
  });

  setSessionCookie(response, result.token, result.expiresAt);
  return response;
});
