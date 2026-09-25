import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, created, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedRole } from '@/lib/auth/rbac';
import { createRequirementForClient } from '@/lib/services/requirement-service';
import { createRequirementSchema } from '@/lib/validation/client';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedRole('CLIENT');
  const body = await parseJsonBody(request, createRequirementSchema);
  const requirement = await createRequirementForClient(auth.user.id, body, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return created({ requirement });
});
