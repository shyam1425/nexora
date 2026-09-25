import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Use a strong password you do not use for any other service."
      footer="Changing your password signs out all active sessions."
    >
      <Suspense><ResetPasswordForm /></Suspense>
    </AuthShell>
  );
}
