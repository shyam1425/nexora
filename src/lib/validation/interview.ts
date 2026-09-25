import { z } from 'zod';

export const scheduleInterviewSchema = z.object({
  applicationId: z.string().trim().min(1).max(64),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(15).max(480).default(45),
  mode: z.enum(['IN_PERSON', 'VIDEO', 'PHONE']).default('VIDEO'),
  roundNumber: z.coerce.number().int().min(1).max(50).default(1),
  roundName: z.string().trim().max(120).optional().or(z.literal('')),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  meetingLink: z.string().trim().url().max(500).refine((value) => /^https?:\/\//i.test(value), 'Meeting link must use HTTP or HTTPS').optional().or(z.literal('')),
  interviewerName: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(5000).optional().or(z.literal('')),
});

export const interviewFeedbackSchema = z.object({
  overallRating: z.coerce.number().int().min(1).max(5),
  technicalRating: z.coerce.number().int().min(1).max(5).optional(),
  communicationRating: z.coerce.number().int().min(1).max(5).optional(),
  recommendation: z.enum(['STRONG_YES', 'YES', 'NO', 'STRONG_NO']),
  strengths: z.string().trim().max(5000).optional().or(z.literal('')),
  weaknesses: z.string().trim().max(5000).optional().or(z.literal('')),
  notes: z.string().trim().max(5000).optional().or(z.literal('')),
});

export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;
export type InterviewFeedbackInput = z.infer<typeof interviewFeedbackSchema>;
