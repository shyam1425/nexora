import { assertSameOrigin, ok, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/rbac';
import { markNotificationRead } from '@/lib/notifications/service';

export const runtime = 'nodejs';

export const PATCH = routeHandler(async (_request, context: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(_request);
  const auth = await requireAuth();
  const { id } = await context.params;
  await markNotificationRead(id, auth.user.id);
  return ok({ read: true });
});
