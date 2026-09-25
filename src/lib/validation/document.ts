import { z } from 'zod';

export const documentCategories = [
  'RESUME', 'ID_PROOF', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER',
  'OFFER_LETTER', 'EMPLOYMENT_CONTRACT', 'PAYSLIP', 'OTHER',
] as const;

export const uploadDocumentSchema = z.object({
  category: z.enum(documentCategories).default('OTHER'),
  candidateProfileId: z.string().trim().max(64).optional().or(z.literal('')),
  employeeId: z.string().trim().max(64).optional().or(z.literal('')),
  applicationId: z.string().trim().max(64).optional().or(z.literal('')),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
