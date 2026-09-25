import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  fieldErrors,
  registerCandidateSchema,
  registerClientSchema,
} from '@/lib/validation/auth';

const validCandidate = {
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'ASHA.RAO@example.com',
  phone: '+91 90000 00000',
  password: 'StrongPass123',
  confirmPassword: 'StrongPass123',
  acceptTerms: true as const,
};

describe('authentication validation', () => {
  it('normalizes valid email addresses', () => {
    expect(emailSchema.parse('  PERSON@Example.COM ')).toBe('person@example.com');
  });

  it('accepts a valid candidate registration', () => {
    const result = registerCandidateSchema.parse(validCandidate);
    expect(result.email).toBe('asha.rao@example.com');
    expect(result.phone).toBe('+91 90000 00000');
  });

  it('rejects weak passwords and missing consent', () => {
    const result = registerCandidateSchema.safeParse({
      ...validCandidate,
      password: 'weakpassword',
      confirmPassword: 'weakpassword',
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.confirmPassword).toBeUndefined();
      expect(errors.acceptTerms).toBeDefined();
      expect(errors.password).toBeDefined();
    }
  });

  it('rejects a password confirmation mismatch', () => {
    const result = registerCandidateSchema.safeParse({
      ...validCandidate,
      confirmPassword: 'DifferentPass123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).confirmPassword).toBeDefined();
    }
  });

  it('validates client registration independently of the UI', () => {
    const result = registerClientSchema.safeParse({
      companyName: 'Acme Staffing Pvt Ltd',
      contactName: 'Ravi Kumar',
      email: 'ravi@acme.example',
      phone: '',
      industry: 'Technology',
      city: 'Bengaluru',
      password: 'StrongPass123',
      confirmPassword: 'StrongPass123',
      acceptTerms: true,
    });
    expect(result.success).toBe(true);
  });
});
