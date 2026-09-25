import { z } from 'zod';

export const createOfferSchema = z.object({
  applicationId: z.string().trim().min(1).max(64),
  designation: z.string().trim().min(2).max(160),
  annualCtc: z.coerce.number().positive().max(100000000),
  currency: z.string().trim().length(3).default('INR'),
  joiningDate: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
  probationMonths: z.coerce.number().int().min(0).max(36).optional(),
  location: z.string().trim().max(160).optional().or(z.literal('')),
  notes: z.string().trim().max(5000).optional().or(z.literal('')),
});

export const offerResponseSchema = z.object({
  decision: z.enum(['ACCEPT', 'DECLINE']),
  responseNote: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type OfferResponseInput = z.infer<typeof offerResponseSchema>;
