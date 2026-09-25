import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, ok, routeHandler, userAgent } from '@/lib/api';
import { env } from '@/lib/env';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/auth/rbac';
import { resendVerificationEmail } from '@/lib/services/auth-service';

export const runtime = 'nodejs';

/** Re-sends the verification email for the signed-in account. */
export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const auth = await requireAuth();
  const ip = clientIp(request);

  enforceRateLimit(
    `resend-verification:user:${auth.user.id}`,
    3,
    env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
  );

  await resendVerificationEmail(auth.user.id, {
    ipAddress: ip,
    userAgent: userAgent(request),
  });

  return ok({ sent: true });
});
