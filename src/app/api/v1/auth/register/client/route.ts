import type { NextRequest } from 'next/server';
import {
  assertSameOrigin,
  clientIp,
  created,
  parseJsonBody,
  routeHandler,
  userAgent,
} from '@/lib/api';
import { env } from '@/lib/env';
import { enforceRateLimit } from '@/lib/rate-limit';
import { setSessionCookie } from '@/lib/auth/session';
import { registerClientAccount } from '@/lib/services/auth-service';
import { registerClientSchema } from '@/lib/validation/auth';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const ip = clientIp(request);

  enforceRateLimit(
    `register:client:ip:${ip}`,
    env.AUTH_RATE_LIMIT_MAX,
    env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
  );

  const body = await parseJsonBody(request, registerClientSchema);

  const result = await registerClientAccount(body, {
    ipAddress: ip,
    userAgent: userAgent(request),
  });

  const response = created({
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      emailVerified: false,
    },
    clientId: result.clientId,
    redirectTo: '/client',
  });

  setSessionCookie(response, result.token, result.expiresAt);
  return response;
});
