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
import { resetPassword } from '@/lib/services/auth-service';
import { resetPasswordSchema } from '@/lib/validation/auth';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const ip = clientIp(request);

  enforceRateLimit(
    `reset-password:ip:${ip}`,
    env.AUTH_RATE_LIMIT_MAX,
    env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
  );

  const body = await parseJsonBody(request, resetPasswordSchema);
  const result = await resetPassword(body.token, body.password, {
    ipAddress: ip,
    userAgent: userAgent(request),
  });

  return ok({
    reset: true,
    email: result.email,
    message: 'Your password has been updated. Please sign in again.',
  });
});
