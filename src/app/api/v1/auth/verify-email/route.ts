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
import { verifyEmail } from '@/lib/services/auth-service';
import { verifyEmailSchema } from '@/lib/validation/auth';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const ip = clientIp(request);
  enforceRateLimit(
    `verify-email:ip:${ip}`,
    env.AUTH_RATE_LIMIT_MAX * 2,
    env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
  );

  const body = await parseJsonBody(request, verifyEmailSchema);
  const result = await verifyEmail(body.token, {
    ipAddress: ip,
    userAgent: userAgent(request),
  });

  return ok({ verified: true, email: result.email });
});
