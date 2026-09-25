import type { Role } from '@/generated/prisma/enums';
import { AppError, ForbiddenError, UnauthorizedError } from '../errors';
import { getAuthContext, type AuthContext } from './session';

/**
 * Central permission matrix.
 *
 * Every protected operation must be expressed here (server side) instead of
 * being enforced only in the UI. Adding a capability means adding one entry.
 */
export const PERMISSIONS = {
  'user.read': ['SUPER_ADMIN', 'ADMIN'],
  'user.manage': ['SUPER_ADMIN', 'ADMIN'],

  'client.read.all': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'client.manage': ['SUPER_ADMIN', 'ADMIN'],

  'requirement.create': ['CLIENT', 'SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'requirement.read.all': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'requirement.read.own': ['CLIENT'],
  'requirement.manage': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],

  'job.create': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'job.read.all': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'job.manage': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'job.publish': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],

  'application.read.all': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'application.screen': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'application.change_status': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'submission.manage': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'submission.review': ['CLIENT'],

  'interview.manage': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'offer.manage': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'offer.respond': ['CANDIDATE'],
  'joining.manage': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],

  'candidate.read.all': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],

  'employee.read.all': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],
  'employee.manage': ['SUPER_ADMIN', 'ADMIN'],

  'attendance.manage': ['SUPER_ADMIN', 'ADMIN'],
  'attendance.read.self': ['EMPLOYEE'],
  'leave.request': ['EMPLOYEE'],
  'leave.decide': ['SUPER_ADMIN', 'ADMIN'],
  'leave.read.all': ['SUPER_ADMIN', 'ADMIN'],

  'payroll.manage': ['SUPER_ADMIN', 'ADMIN'],
  'payroll.read.self': ['EMPLOYEE'],

  'document.upload': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'CLIENT', 'CANDIDATE', 'EMPLOYEE'],
  'document.read.all': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'],

  'report.read': ['SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'CLIENT'],
  'audit.read': ['SUPER_ADMIN', 'ADMIN'],
  'settings.manage': ['SUPER_ADMIN'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission] as readonly Role[];
  return allowed.includes(role);
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError(`Your role (${role}) cannot perform: ${permission}`);
  }
}

/** Requires an authenticated, active session. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuthContext();
  if (!auth) {
    throw new UnauthorizedError();
  }
  if (auth.user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Your account is not active');
  }
  return auth;
}

/** Requires an authenticated user holding one of the given roles. */
export async function requireRole(...roles: Role[]): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!roles.includes(auth.user.role)) {
    throw new ForbiddenError(`This action requires one of: ${roles.join(', ')}`);
  }
  return auth;
}

/** Requires an authenticated user whose role grants the permission. */
export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const auth = await requireAuth();
  assertCan(auth.user.role, permission);
  return auth;
}


/** Requires an active session with a verified mailbox for business operations. */
export async function requireVerifiedAuth(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!auth.user.emailVerifiedAt) {
    throw new AppError('EMAIL_NOT_VERIFIED', 'Verify your email address before using this feature.', 403);
  }
  return auth;
}

export async function requireVerifiedPermission(permission: Permission): Promise<AuthContext> {
  const auth = await requireVerifiedAuth();
  assertCan(auth.user.role, permission);
  return auth;
}

export async function requireVerifiedRole(...roles: Role[]): Promise<AuthContext> {
  const auth = await requireVerifiedAuth();
  if (!roles.includes(auth.user.role)) {
    throw new ForbiddenError(`This action requires one of: ${roles.join(', ')}`);
  }
  return auth;
}


export const STAFF_ROLES: readonly Role[] = ['SUPER_ADMIN', 'ADMIN', 'RECRUITER'];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

/** Post-login landing page per role. */
export function dashboardPathForRole(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/admin';
    case 'RECRUITER':
      return '/recruiter';
    case 'CLIENT':
      return '/client';
    case 'CANDIDATE':
      return '/candidate';
    case 'EMPLOYEE':
      return '/employee';
    default:
      return '/';
  }
}
