import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, created, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedPermission } from '@/lib/auth/rbac';
import { createSubmission } from '@/lib/services/submission-service';
import { createSubmissionSchema } from '@/lib/validation/recruitment';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedPermission('submission.manage');
  const body = await parseJsonBody(request, createSubmissionSchema);
  const submission = await createSubmission(body, { userId: auth.user.id, role: auth.user.role }, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return created({ submission });
});
