import { assertSameOrigin, ok, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/rbac';
import { markAllNotificationsRead } from '@/lib/notifications/service';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request) => {
  assertSameOrigin(request);
  const auth = await requireAuth();
  const count = await markAllNotificationsRead(auth.user.id);
  return ok({ read: count });
});
