import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/auth/rbac';
import { CreateRequirementForm } from '@/components/client/create-requirement-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'New manpower requirement' };

export default async function NewRequirementPage() {
  const auth = await getAuthContext();
  if (!auth) redirect('/login?next=/client/requirements/new');
  if (auth.user.role !== 'CLIENT') redirect(dashboardPathForRole(auth.user.role));
  if (!auth.user.emailVerifiedAt) redirect(`/verify-email?email=${encodeURIComponent(auth.user.email)}`);
  return <div className="min-h-screen bg-background"><header className="border-b border-border bg-card"><div className="container-page flex min-h-18 items-center justify-between"><Link href="/client" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" />Back to dashboard</Link><span className="text-sm font-semibold">New requirement</span></div></header><main id="main-content" className="container-page max-w-3xl py-10"><Card><CardHeader><CardTitle>Tell us what you need</CardTitle><p className="text-sm text-muted-foreground">Your requirement becomes visible to the internal recruitment team as soon as you submit it.</p></CardHeader><CardContent><CreateRequirementForm /></CardContent></Card></main></div>;
}
