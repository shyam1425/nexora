import { Suspense } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to NEXORA"
      description="Access your recruiting, client, or employee workspace with your secure account."
      footer={<>New to NEXORA? <Link href="/register/candidate" className="font-medium text-primary hover:underline">Create a candidate account</Link></>}
    >
      <Suspense><LoginForm /></Suspense>
    </AuthShell>
  );
}
