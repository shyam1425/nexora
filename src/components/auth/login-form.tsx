'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return fallback;
  const error = payload.error;
  if (typeof error !== 'object' || error === null || !('message' in error)) return fallback;
  return typeof error.message === 'string' ? error.message : fallback;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          redirectTo: nextPath ?? undefined,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setError(errorMessage(payload, 'We could not sign you in. Check your details.'));
        return;
      }

      const data = payload as { data?: { redirectTo?: string } };
      const destination =
        data.data?.redirectTo && data.data.redirectTo.startsWith('/') && !data.data.redirectTo.startsWith('//')
          ? data.data.redirectTo
          : '/candidate';
      router.replace(destination);
      router.refresh();
    } catch {
      setError('The service is temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <Field label="Work email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </Field>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" className="w-full" size="lg" loading={loading}>Sign in securely</Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">Your session is protected with an HTTP-only cookie and role-based access controls.</p>
    </form>
  );
}
