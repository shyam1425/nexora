import { prisma, type PrismaTx } from '@/lib/prisma';
import { env } from '@/lib/env';
import { sendEmail, type EmailMessage } from './email';

/**
 * In-app notification service.
 *
 * Every business milestone that a human must react to (application received,
 * interview scheduled, offer released, leave decision, payslip ready, ...)
 * creates a Notification row. Rows are written inside the caller's transaction
 * wherever the notification is part of the same business operation.
 */
export const NOTIFICATION_TYPES = {
  WELCOME: 'WELCOME',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  APPLICATION_RECEIVED: 'APPLICATION_RECEIVED',
  APPLICATION_STATUS_CHANGED: 'APPLICATION_STATUS_CHANGED',
  INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
  INTERVIEW_FEEDBACK: 'INTERVIEW_FEEDBACK',
  OFFER_RELEASED: 'OFFER_RELEASED',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
  OFFER_DECLINED: 'OFFER_DECLINED',
  REQUIREMENT_CREATED: 'REQUIREMENT_CREATED',
  SUBMISSION_RECEIVED: 'SUBMISSION_RECEIVED',
  SUBMISSION_STATUS_CHANGED: 'SUBMISSION_STATUS_CHANGED',
  JOINING_SCHEDULED: 'JOINING_SCHEDULED',
  EMPLOYEE_ONBOARDED: 'EMPLOYEE_ONBOARDED',
  LEAVE_REQUESTED: 'LEAVE_REQUESTED',
  LEAVE_DECIDED: 'LEAVE_DECIDED',
  PAYSLIP_AVAILABLE: 'PAYSLIP_AVAILABLE',
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type NotifyInput = {
  userId: string;
  type: NotificationType | string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  link?: string | null;
};

type Client = PrismaTx | typeof prisma;

export async function notify(
  input: NotifyInput,
  client: Client = prisma,
): Promise<void> {
  await client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      link: input.link ?? null,
    },
  });
}

export async function notifyMany(
  inputs: NotifyInput[],
  client: Client = prisma,
): Promise<void> {
  if (!inputs.length) return;
  await client.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      link: input.link ?? null,
    })),
  });
}

/** Notifies every active user holding one of the given roles. */
export async function notifyRoles(
  roles: Array<'SUPER_ADMIN' | 'ADMIN' | 'RECRUITER'>,
  input: Omit<NotifyInput, 'userId'>,
  client: Client = prisma,
): Promise<void> {
  const users = await client.user.findMany({
    where: { role: { in: roles }, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  await notifyMany(
    users.map((user) => ({ ...input, userId: user.id })),
    client,
  );
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Absolute link helper for emails/notifications. */
export function appLink(path: string): string {
  return `${env.APP_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Sends a transactional email (never throws). */
export async function sendTransactionalEmail(message: EmailMessage): Promise<boolean> {
  return sendEmail(message);
}
