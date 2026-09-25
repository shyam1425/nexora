import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, created, parseJsonBody, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedPermission } from '@/lib/auth/rbac';
import { scheduleInterview } from '@/lib/services/interview-service';
import { scheduleInterviewSchema } from '@/lib/validation/interview';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedPermission('interview.manage');
  const body = await parseJsonBody(request, scheduleInterviewSchema);
  const interview = await scheduleInterview(body, { userId: auth.user.id, role: auth.user.role }, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return created({ interview });
});
