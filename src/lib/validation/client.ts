import { z } from 'zod';

const requirementWorkModes = ['ONSITE', 'REMOTE', 'HYBRID'] as const;
const requirementEmploymentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'] as const;
const requirementPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const createRequirementSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(160),
  description: z.string().trim().min(20, 'Description must be at least 20 characters').max(20000),
  skills: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  positionsCount: z.coerce.number().int().min(1).max(1000).default(1),
  location: z.string().trim().max(160).optional().or(z.literal('')),
  workMode: z.enum(requirementWorkModes).default('ONSITE'),
  employmentType: z.enum(requirementEmploymentTypes).default('FULL_TIME'),
  minExperienceMonths: z.coerce.number().int().min(0).max(600).optional(),
  maxExperienceMonths: z.coerce.number().int().min(0).max(600).optional(),
  budgetMin: z.coerce.number().min(0).max(100000000).optional(),
  budgetMax: z.coerce.number().min(0).max(100000000).optional(),
  priority: z.enum(requirementPriorities).default('MEDIUM'),
  targetDate: z.coerce.date().optional(),
}).refine((value) => value.maxExperienceMonths === undefined || value.minExperienceMonths === undefined || value.maxExperienceMonths >= value.minExperienceMonths, { path: ['maxExperienceMonths'], message: 'Maximum experience must be greater than or equal to minimum experience' })
  .refine((value) => value.budgetMax === undefined || value.budgetMin === undefined || value.budgetMax >= value.budgetMin, { path: ['budgetMax'], message: 'Maximum budget must be greater than or equal to minimum budget' });

export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
