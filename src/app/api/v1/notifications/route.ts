import { ok, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export const GET = routeHandler(async () => {
  const auth = await requireAuth();
  const [notifications, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: { userId: auth.user.id, readAt: null } }),
  ]);
  return ok({ notifications, unreadCount });
});
