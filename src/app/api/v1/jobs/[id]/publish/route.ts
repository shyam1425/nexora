import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, ok, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedPermission } from '@/lib/auth/rbac';
import { publishJob } from '@/lib/services/job-service';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedPermission('job.publish');
  const { id } = await context.params;
  const job = await publishJob(id, { userId: auth.user.id, role: auth.user.role }, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return ok({ job });
});
