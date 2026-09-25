import { describe, expect, it } from 'vitest';
import { canManuallyTransitionApplication, canTransitionApplication } from '@/lib/services/application-state';

describe('application status state machine', () => {
  it('allows only forward business transitions', () => {
    expect(canTransitionApplication('APPLIED', 'SCREENING')).toBe(true);
    expect(canTransitionApplication('SCREENING', 'SHORTLISTED')).toBe(true);
    expect(canTransitionApplication('SHORTLISTED', 'INTERVIEW_SCHEDULED')).toBe(true);
    expect(canTransitionApplication('INTERVIEW_COMPLETED', 'SELECTED')).toBe(true);
    expect(canTransitionApplication('SELECTED', 'OFFERED')).toBe(true);
  });

  it('does not allow rejected or withdrawn applications to move forward', () => {
    expect(canTransitionApplication('REJECTED', 'OFFER_ACCEPTED')).toBe(false);
    expect(canTransitionApplication('WITHDRAWN', 'SCREENING')).toBe(false);
    expect(canTransitionApplication('JOINED', 'REJECTED')).toBe(false);
    expect(canTransitionApplication('OFFER_DECLINED', 'JOINING')).toBe(false);
  });

  it('requires an explicit rejection or withdrawal branch', () => {
    expect(canTransitionApplication('APPLIED', 'REJECTED')).toBe(true);
    expect(canTransitionApplication('APPLIED', 'WITHDRAWN')).toBe(true);
    expect(canTransitionApplication('OFFERED', 'OFFER_ACCEPTED')).toBe(true);
    expect(canTransitionApplication('OFFERED', 'OFFER_DECLINED')).toBe(true);
  });

  it('reserves workflow states for their transaction services', () => {
    expect(canManuallyTransitionApplication('APPLIED', 'SCREENING')).toBe(true);
    expect(canManuallyTransitionApplication('SCREENING', 'SHORTLISTED')).toBe(true);
    expect(canManuallyTransitionApplication('INTERVIEW_COMPLETED', 'SELECTED')).toBe(true);
    expect(canManuallyTransitionApplication('SHORTLISTED', 'INTERVIEW_SCHEDULED')).toBe(false);
    expect(canManuallyTransitionApplication('INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED')).toBe(false);
    expect(canManuallyTransitionApplication('SELECTED', 'OFFERED')).toBe(false);
    expect(canManuallyTransitionApplication('OFFERED', 'OFFER_ACCEPTED')).toBe(false);
    expect(canManuallyTransitionApplication('OFFER_ACCEPTED', 'JOINING')).toBe(false);
    expect(canManuallyTransitionApplication('JOINING', 'JOINED')).toBe(false);
  });
});
