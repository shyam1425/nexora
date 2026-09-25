'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>(token ? 'idle' : 'success');
  const [message, setMessage] = useState(token ? '' : 'Check your inbox for the verification link.');
  const [loading, setLoading] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const error = typeof payload === 'object' && payload !== null && 'error' in payload ? payload.error : null;
        const text = typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : 'This verification link is invalid or expired.';
        setStatus('error');
        setMessage(text);
        return;
      }
      setStatus('success');
      setMessage('Your email is verified. You can now sign in to your workspace.');
    } catch {
      setStatus('error');
      setMessage('The service is temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {email ? <p className="text-sm text-muted-foreground">Verification link sent to <strong className="text-foreground">{email}</strong>.</p> : null}
      {status !== 'idle' ? <Alert variant={status === 'success' ? 'success' : 'destructive'}>{message}</Alert> : null}
      {token && status !== 'success' ? (
        <form onSubmit={verify}>
          <Button type="submit" className="w-full" size="lg" loading={loading}>Verify my email</Button>
        </form>
      ) : null}
      {status === 'success' ? <Button asChild className="w-full" size="lg"><Link href="/login">Continue to sign in</Link></Button> : null}
      <p className="text-center text-xs text-muted-foreground">Did not receive an email? Check your spam folder or contact your administrator.</p>
    </div>
  );
}
