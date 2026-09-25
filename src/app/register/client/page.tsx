import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { RegistrationForm } from '@/components/auth/registration-form';

export const metadata = { title: 'Client registration' };

export default function ClientRegistrationPage() {
  return (
    <AuthShell
      eyebrow="Client portal"
      title="Set up your company workspace"
      description="Share manpower requirements, review submissions, and keep hiring decisions moving."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link></>}
    >
      <RegistrationForm kind="client" />
    </AuthShell>
  );
}
