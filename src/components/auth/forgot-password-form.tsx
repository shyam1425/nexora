'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError('Enter a valid email address and try again.');
        return;
      }
      setMessage('If an account exists for that address, a password reset link has been sent.');
    } catch {
      setError('The service is temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      <Field label="Account email" htmlFor="email" required>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>Send reset link</Button>
      <p className="text-center text-sm text-muted-foreground"><Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
    </form>
  );
}
