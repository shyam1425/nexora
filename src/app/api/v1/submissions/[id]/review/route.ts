import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, ok, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedRole } from '@/lib/auth/rbac';
import { reviewSubmission } from '@/lib/services/submission-review-service';
import { reviewSubmissionSchema } from '@/lib/validation/recruitment';

export const runtime = 'nodejs';

export const PATCH = routeHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedRole('CLIENT');
  const { id } = await context.params;
  const body = await parseJsonBody(request, reviewSubmissionSchema);
  const submission = await reviewSubmission(id, body, auth.user.id, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return ok({ submission });
});
