import { z } from 'zod';
import { nameSchema, phoneSchema } from './auth';

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const updateCandidateProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  city: optionalText(100),
  state: optionalText(100),
  country: optionalText(100),
  headline: optionalText(160),
  summary: optionalText(5000),
  totalExperienceMonths: z.coerce.number().int().min(0).max(600),
  currentCtc: z.number().min(0).max(1_000_000_000).nullable().optional(),
  expectedCtc: z.number().min(0).max(1_000_000_000).nullable().optional(),
  noticePeriodDays: z.number().int().min(0).max(365).nullable().optional(),
  currentCompany: optionalText(160),
  currentDesignation: optionalText(160),
  skills: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  linkedinUrl: z.string().trim().url().max(300).optional().or(z.literal('')),
  portfolioUrl: z.string().trim().url().max(300).optional().or(z.literal('')),
});

export type UpdateCandidateProfileInput = z.infer<typeof updateCandidateProfileSchema>;
