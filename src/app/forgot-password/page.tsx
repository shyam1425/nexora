import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter your account email and we will send a secure, time-limited reset link if the account exists."
      footer="For your protection, we never reveal whether an email is registered."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
