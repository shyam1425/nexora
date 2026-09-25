import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, created, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedPermission } from '@/lib/auth/rbac';
import { createAndSendOffer } from '@/lib/services/offer-service';
import { createOfferSchema } from '@/lib/validation/offer';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedPermission('offer.manage');
  const body = await parseJsonBody(request, createOfferSchema);
  const offer = await createAndSendOffer(body, { userId: auth.user.id, role: auth.user.role }, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return created({ offer });
});
