import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';

export const metadata = { title: 'Verify your email' };

export default function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="Account security"
      title="Verify your email"
      description="Confirm your email address to activate secure sign-in and protect your account."
      footer="Your verification link is single-use and expires automatically."
    >
      <Suspense><VerifyEmailForm /></Suspense>
    </AuthShell>
  );
}
