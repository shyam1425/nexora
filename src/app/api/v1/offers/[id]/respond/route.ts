import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, ok, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedRole } from '@/lib/auth/rbac';
import { respondToOffer } from '@/lib/services/offer-service';
import { offerResponseSchema } from '@/lib/validation/offer';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedRole('CANDIDATE');
  const { id } = await context.params;
  const body = await parseJsonBody(request, offerResponseSchema);
  const result = await respondToOffer(id, body, { userId: auth.user.id, role: auth.user.role }, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return ok(result);
});
