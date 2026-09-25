import { z } from 'zod';

export const completeJoiningSchema = z.object({
  actualJoiningDate: z.coerce.date(),
  notes: z.string().trim().max(5000).optional().or(z.literal('')),
});

export type CompleteJoiningInput = z.infer<typeof completeJoiningSchema>;
