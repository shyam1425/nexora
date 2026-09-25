import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { markAllNotificationsRead, markNotificationRead, notify } from '@/lib/notifications/service';

describe('notification ownership', () => {
  it('marks only the current user notifications as read', async () => {
    const suffix = randomUUID().slice(0, 8);
    const owner = await prisma.user.create({ data: { email: `notification-owner-${suffix}@example.com`, passwordHash: 'test-only', role: 'CANDIDATE', status: 'ACTIVE' } });
    const other = await prisma.user.create({ data: { email: `notification-other-${suffix}@example.com`, passwordHash: 'test-only', role: 'CANDIDATE', status: 'ACTIVE' } });
    try {
      await notify({ userId: owner.id, type: 'TEST', title: 'Owner notification' });
      await notify({ userId: other.id, type: 'TEST', title: 'Other notification' });
      const ownerNotification = await prisma.notification.findFirstOrThrow({ where: { userId: owner.id } });
      const otherNotification = await prisma.notification.findFirstOrThrow({ where: { userId: other.id } });

      await markNotificationRead(ownerNotification.id, other.id);
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: ownerNotification.id } })).readAt).toBeNull();
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: otherNotification.id } })).readAt).toBeNull();

      await markNotificationRead(ownerNotification.id, owner.id);
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: ownerNotification.id } })).readAt).not.toBeNull();
      const count = await markAllNotificationsRead(owner.id);
      expect(count).toBe(0);
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: otherNotification.id } })).readAt).toBeNull();
    } finally {
      await prisma.notification.deleteMany({ where: { userId: { in: [owner.id, other.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    }
  });
});
