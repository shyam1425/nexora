import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, ok, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedRole } from '@/lib/auth/rbac';
import { env } from '@/lib/env';
import { enforceRateLimit } from '@/lib/rate-limit';
import { updateCandidateProfile } from '@/lib/services/candidate-profile-service';
import { updateCandidateProfileSchema } from '@/lib/validation/candidate';

export const runtime = 'nodejs';

export const PATCH = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedRole('CANDIDATE');
  enforceRateLimit(`candidate-profile:user:${auth.user.id}`, 20, env.AUTH_RATE_LIMIT_WINDOW_SECONDS);
  const body = await parseJsonBody(request, updateCandidateProfileSchema);
  const profile = await updateCandidateProfile(
    { userId: auth.user.id, role: auth.user.role },
    body,
    { ipAddress: clientIp(request), userAgent: userAgent(request) },
  );
  return ok({ profile });
});
