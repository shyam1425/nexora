import { z } from 'zod';

export const applyToJobSchema = z.object({
  jobId: z.string().trim().min(1, 'Job is required').max(64),
  coverLetter: z
    .string()
    .trim()
    .max(5000, 'Cover letter is too long')
    .optional()
    .or(z.literal('')),
});

export type ApplyToJobInput = z.infer<typeof applyToJobSchema>;


export const applicationStatuses = [
  'APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED',
  'SELECTED', 'OFFERED', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'JOINING', 'JOINED',
  'REJECTED', 'WITHDRAWN',
] as const;
export type ApplicationStatusValue = (typeof applicationStatuses)[number];

export const transitionApplicationSchema = z.object({
  toStatus: z.enum(applicationStatuses),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
});

const employmentTypeValues = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'] as const;
const workModeValues = ['ONSITE', 'REMOTE', 'HYBRID'] as const;

export const createJobSchema = z.object({
  clientId: z.string().trim().min(1, 'Client is required').max(64),
  requirementId: z.string().trim().max(64).optional().or(z.literal('')),
  title: z.string().trim().min(2, 'Title is required').max(160),
  description: z.string().trim().min(20, 'Description must be at least 20 characters').max(20000),
  responsibilities: z.string().trim().max(10000).optional().or(z.literal('')),
  requirements: z.string().trim().max(10000).optional().or(z.literal('')),
  skills: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  employmentType: z.enum(employmentTypeValues).default('FULL_TIME'),
  workMode: z.enum(workModeValues).default('ONSITE'),
  location: z.string().trim().max(160).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  minExperienceMonths: z.coerce.number().int().min(0).max(600).optional(),
  positionsCount: z.coerce.number().int().min(1).max(1000).default(1),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const createSubmissionSchema = z.object({
  clientId: z.string().trim().min(1).max(64),
  requirementId: z.string().trim().max(64).optional().or(z.literal('')),
  jobId: z.string().trim().min(1).max(64),
  candidateProfileId: z.string().trim().min(1).max(64),
  note: z.string().trim().max(5000).optional().or(z.literal('')),
});
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export type SubmissionStatusValue =
  | 'SUBMITTED'
  | 'CLIENT_REVIEW'
  | 'CLIENT_SHORTLISTED'
  | 'CLIENT_REJECTED'
  | 'INTERVIEW'
  | 'SELECTED'
  | 'OFFERED'
  | 'JOINED'
  | 'DROPPED';

export const submissionReviewTransitions: Record<SubmissionStatusValue, readonly SubmissionStatusValue[]> = {
  SUBMITTED: ['CLIENT_REVIEW', 'CLIENT_REJECTED', 'DROPPED'],
  CLIENT_REVIEW: ['CLIENT_SHORTLISTED', 'CLIENT_REJECTED', 'DROPPED'],
  CLIENT_SHORTLISTED: ['DROPPED'],
  INTERVIEW: ['DROPPED'],
  SELECTED: ['DROPPED'],
  OFFERED: ['DROPPED'],
  JOINED: [],
  DROPPED: [],
  CLIENT_REJECTED: [],
};

export const reviewSubmissionSchema = z.object({
  status: z.enum(['CLIENT_REVIEW', 'CLIENT_SHORTLISTED', 'CLIENT_REJECTED', 'DROPPED']),
  note: z.string().trim().max(5000).optional().or(z.literal('')),
});
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;

export type TransitionApplicationInput = z.infer<typeof transitionApplicationSchema>;
