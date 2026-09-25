import type { Prisma } from '@/generated/prisma/client';
import { prisma, type PrismaTx } from './prisma';
import { logger } from './logger';

/**
 * Audit trail.
 *
 * Business-critical writes call recordAudit(...) inside the same transaction
 * as the mutation so an audit record can never be silently lost.
 */
export const AUDIT_ACTIONS = {
  LOGIN_SUCCEEDED: 'LOGIN_SUCCEEDED',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  USER_REGISTERED: 'USER_REGISTERED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DISABLED: 'USER_DISABLED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  EMAIL_VERIFICATION_RESENT: 'EMAIL_VERIFICATION_RESENT',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',

  CLIENT_CREATED: 'CLIENT_CREATED',
  CLIENT_UPDATED: 'CLIENT_UPDATED',
  CLIENT_USER_LINKED: 'CLIENT_USER_LINKED',

  REQUIREMENT_CREATED: 'REQUIREMENT_CREATED',
  REQUIREMENT_UPDATED: 'REQUIREMENT_UPDATED',
  REQUIREMENT_STATUS_CHANGED: 'REQUIREMENT_STATUS_CHANGED',

  JOB_CREATED: 'JOB_CREATED',
  JOB_UPDATED: 'JOB_UPDATED',
  JOB_PUBLISHED: 'JOB_PUBLISHED',
  JOB_STATUS_CHANGED: 'JOB_STATUS_CHANGED',

  APPLICATION_CREATED: 'APPLICATION_CREATED',
  APPLICATION_STATUS_CHANGED: 'APPLICATION_STATUS_CHANGED',
  APPLICATION_WITHDRAWN: 'APPLICATION_WITHDRAWN',
  APPLICATION_SCREENED: 'APPLICATION_SCREENED',

  SUBMISSION_CREATED: 'SUBMISSION_CREATED',
  SUBMISSION_STATUS_CHANGED: 'SUBMISSION_STATUS_CHANGED',

  INTERVIEW_CREATED: 'INTERVIEW_CREATED',
  INTERVIEW_UPDATED: 'INTERVIEW_UPDATED',
  INTERVIEW_CANCELLED: 'INTERVIEW_CANCELLED',
  INTERVIEW_FEEDBACK_RECORDED: 'INTERVIEW_FEEDBACK_RECORDED',

  OFFER_CREATED: 'OFFER_CREATED',
  OFFER_SENT: 'OFFER_SENT',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
  OFFER_DECLINED: 'OFFER_DECLINED',
  OFFER_WITHDRAWN: 'OFFER_WITHDRAWN',

  JOINING_CREATED: 'JOINING_CREATED',
  JOINING_COMPLETED: 'JOINING_COMPLETED',
  EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
  EMPLOYEE_UPDATED: 'EMPLOYEE_UPDATED',
  EMPLOYEE_ACTIVATED: 'EMPLOYEE_ACTIVATED',

  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_ACCESSED: 'DOCUMENT_ACCESSED',
  DOCUMENT_DELETED: 'DOCUMENT_DELETED',

  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
  LEAVE_REQUESTED: 'LEAVE_REQUESTED',
  LEAVE_DECIDED: 'LEAVE_DECIDED',

  PAYROLL_PROCESSED: 'PAYROLL_PROCESSED',
  PAYROLL_APPROVED: 'PAYROLL_APPROVED',
  PAYROLL_PAID: 'PAYROLL_PAID',

  SETTING_UPDATED: 'SETTING_UPDATED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditInput = {
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Writes an audit row. Pass the surrounding transaction client when auditing a
 * multi-step business operation.
 */
export async function recordAudit(
  input: AuditInput,
  client: PrismaTx | typeof prisma = prisma,
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        metadata: toJson(input.metadata),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    });
  } catch (error) {
    // A transaction must fail closed if its audit record cannot be written;
    // otherwise a business mutation could commit without its required trail.
    if (client !== prisma) throw error;
    logger.error('audit_write_failed', {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function toJson(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
