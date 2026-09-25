import { describe, expect, it } from 'vitest';
import {
  dashboardPathForRole,
  can,
  isStaff,
} from '@/lib/auth/rbac';

describe('role based access control', () => {
  it('keeps candidate permissions separate from staff permissions', () => {
    expect(can('CANDIDATE', 'offer.respond')).toBe(true);
    expect(can('CANDIDATE', 'application.screen')).toBe(false);
    expect(can('RECRUITER', 'application.screen')).toBe(true);
    expect(can('CLIENT', 'submission.review')).toBe(true);
    expect(can('CLIENT', 'job.create')).toBe(false);
    expect(can('EMPLOYEE', 'leave.request')).toBe(true);
    expect(can('EMPLOYEE', 'leave.decide')).toBe(false);
  });

  it('identifies internal staff roles', () => {
    expect(isStaff('SUPER_ADMIN')).toBe(true);
    expect(isStaff('RECRUITER')).toBe(true);
    expect(isStaff('CLIENT')).toBe(false);
    expect(isStaff('CANDIDATE')).toBe(false);
  });

  it('restricts audit.read to administrators', () => {
    expect(can('SUPER_ADMIN', 'audit.read')).toBe(true);
    expect(can('ADMIN', 'audit.read')).toBe(true);
    expect(can('RECRUITER', 'audit.read')).toBe(false);
    expect(can('CLIENT', 'audit.read')).toBe(false);
    expect(can('CANDIDATE', 'audit.read')).toBe(false);
  });

  it('routes each role to its own dashboard', () => {
    expect(dashboardPathForRole('SUPER_ADMIN')).toBe('/admin');
    expect(dashboardPathForRole('RECRUITER')).toBe('/recruiter');
    expect(dashboardPathForRole('CLIENT')).toBe('/client');
    expect(dashboardPathForRole('CANDIDATE')).toBe('/candidate');
    expect(dashboardPathForRole('EMPLOYEE')).toBe('/employee');
  });
});
