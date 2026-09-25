import { z } from 'zod';
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  passwordProblem,
} from '@/lib/auth/password';

/**
 * Shared validation schemas.
 *
 * The same schemas are used by API routes (server-side, authoritative) and by
 * forms (client-side, for fast feedback). Server validation is never skipped.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Email is required')
  .max(254, 'Email is too long')
  .refine((value) => EMAIL_REGEX.test(value), 'Enter a valid email address');

export const phoneSchema = z
  .string()
  .trim()
  .max(20, 'Phone number is too long')
  .refine((value) => value === '' || /^[+()\d\s-]{7,20}$/.test(value), 'Enter a valid phone number')
  .optional()
  .or(z.literal(''));

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(200, 'Password is too long')
  .refine(
    (value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES,
    `Password must not exceed ${MAX_PASSWORD_BYTES} bytes`,
  )
  .refine((value) => passwordProblem(value) === null, {
    message:
      'Password must include lower case, upper case and numeric characters',
  });

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name is too long');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
  redirectTo: z.string().max(200).optional(),
});

export const registerCandidateSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      message: 'You must accept the terms to continue',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const registerClientSchema = z
  .object({
    companyName: z.string().trim().min(2, 'Company name is required').max(150),
    contactName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    industry: z.string().trim().max(100).optional().or(z.literal('')),
    city: z.string().trim().max(80).optional().or(z.literal('')),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      message: 'You must accept the terms to continue',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const verifyEmailSchema = z.object({
  token: z.string().min(10, 'Verification token is required').max(200),
});

export const resendVerificationSchema = z.object({
  email: emailSchema.optional(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterCandidateInput = z.infer<typeof registerCandidateSchema>;
export type RegisterClientInput = z.infer<typeof registerClientSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Converts a ZodError into a `{ field: [messages] }` map suitable for form
 * rendering.
 */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}
