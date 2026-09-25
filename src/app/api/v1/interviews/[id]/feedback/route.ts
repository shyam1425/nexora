import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, created, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedPermission } from '@/lib/auth/rbac';
import { recordInterviewFeedback } from '@/lib/services/interview-service';
import { interviewFeedbackSchema } from '@/lib/validation/interview';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedPermission('interview.manage');
  const { id } = await context.params;
  const body = await parseJsonBody(request, interviewFeedbackSchema);
  const feedback = await recordInterviewFeedback(id, body, { userId: auth.user.id, role: auth.user.role }, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return created({ feedback });
});
