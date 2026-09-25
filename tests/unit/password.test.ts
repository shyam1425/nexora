import { describe, expect, it } from 'vitest';
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  generateTemporaryPassword,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from '@/lib/auth/password';

describe('password security helpers', () => {
  it('hashes and verifies a password without storing the plaintext', async () => {
    const password = 'StrongPass123';
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword('WrongPass123', hash)).resolves.toBe(false);
  });

  it('enforces length, byte limit, and character diversity', () => {
    expect(passwordProblem('short1A')).toContain('at least');
    expect(passwordProblem('alllowercase123')).toContain('uppercase');
    expect(passwordProblem('NoNumbersHere')).toContain('number');
    expect(passwordProblem('ValidPassword123')).toBeNull();
    expect(passwordProblem('Abcdefghij1')).toBeNull();
    expect(passwordProblem('A'.repeat(MAX_PASSWORD_BYTES + 1) + '1')).toContain('bytes');
  });

  it('generates a valid temporary password', () => {
    const password = generateTemporaryPassword();
    expect(passwordProblem(password)).toBeNull();
    expect(password.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
  });
});
