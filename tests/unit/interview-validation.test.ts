import { describe, expect, it } from 'vitest';
import { scheduleInterviewSchema } from '@/lib/validation/interview';

describe('interview validation', () => {
  it('accepts HTTP and HTTPS meeting links', () => {
    const base = {
      applicationId: 'app-1',
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      durationMinutes: 45,
      mode: 'VIDEO',
      roundNumber: 1,
      roundName: 'Technical',
      location: '',
      interviewerName: 'Recruiter',
      notes: '',
    };
    expect(scheduleInterviewSchema.safeParse({ ...base, meetingLink: 'https://meet.example/session' }).success).toBe(true);
    expect(scheduleInterviewSchema.safeParse({ ...base, meetingLink: 'http://meet.example/session' }).success).toBe(true);
  });

  it('rejects non-HTTP meeting links', () => {
    const result = scheduleInterviewSchema.safeParse({
      applicationId: 'app-1',
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      durationMinutes: 45,
      mode: 'VIDEO',
      roundNumber: 1,
      meetingLink: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });
});

