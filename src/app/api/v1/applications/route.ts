import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, created, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedRole } from '@/lib/auth/rbac';
import { env } from '@/lib/env';
import { enforceRateLimit } from '@/lib/rate-limit';
import { applyToJob } from '@/lib/services/application-service';
import { applyToJobSchema } from '@/lib/validation/recruitment';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedRole('CANDIDATE');
  const ip = clientIp(request);
  enforceRateLimit(`apply:user:${auth.user.id}`, 10, env.AUTH_RATE_LIMIT_WINDOW_SECONDS);
  const body = await parseJsonBody(request, applyToJobSchema);
  const application = await applyToJob(auth.user.id, body, { ipAddress: ip, userAgent: userAgent(request) });
  return created({ application });
});
