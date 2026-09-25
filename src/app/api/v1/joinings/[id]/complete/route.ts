import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, ok, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedPermission } from '@/lib/auth/rbac';
import { completeJoining } from '@/lib/services/joining-service';
import { completeJoiningSchema } from '@/lib/validation/joining';

export const runtime = 'nodejs';

export const PATCH = routeHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedPermission('joining.manage');
  const { id } = await context.params;
  const body = await parseJsonBody(request, completeJoiningSchema);
  const employee = await completeJoining(id, body, { userId: auth.user.id, role: auth.user.role }, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return ok({ employee });
});
