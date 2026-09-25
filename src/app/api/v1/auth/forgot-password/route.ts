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
import { requestPasswordReset } from '@/lib/services/auth-service';
import { forgotPasswordSchema } from '@/lib/validation/auth';

export const runtime = 'nodejs';

/**
 * Always returns the same response whether or not the account exists, so the
 * endpoint cannot be used to enumerate registered email addresses.
 */
export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const ip = clientIp(request);

  enforceRateLimit(
    `forgot-password:ip:${ip}`,
    env.AUTH_RATE_LIMIT_MAX,
    env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
  );

  const body = await parseJsonBody(request, forgotPasswordSchema);
  enforceRateLimit(`forgot-password:account:${body.email}`, 3, 15 * 60);

  await requestPasswordReset(body.email, {
    ipAddress: ip,
    userAgent: userAgent(request),
  });

  return ok({
    message:
      'If an account exists for that address, a password reset link has been sent.',
  });
});
