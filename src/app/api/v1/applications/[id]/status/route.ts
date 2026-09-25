import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, ok, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedAuth } from '@/lib/auth/rbac';
import { transitionApplicationStatus } from '@/lib/services/application-state';
import { transitionApplicationSchema } from '@/lib/validation/recruitment';

export const runtime = 'nodejs';

export const PATCH = routeHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedAuth();
  const { id } = await context.params;
  const body = await parseJsonBody(request, transitionApplicationSchema);
  const application = await transitionApplicationStatus(id, body, { userId: auth.user.id, role: auth.user.role }, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return ok({ application });
});
