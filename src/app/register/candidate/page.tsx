import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { RegistrationForm } from '@/components/auth/registration-form';

export const metadata = { title: 'Candidate registration' };

export default function CandidateRegistrationPage() {
  return (
    <AuthShell
      eyebrow="Candidate portal"
      title="Create your candidate profile"
      description="Start your application journey and keep every opportunity in one place."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link></>}
    >
      <RegistrationForm kind="candidate" />
    </AuthShell>
  );
}
