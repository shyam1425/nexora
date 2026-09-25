import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { CreateJobForm } from '@/components/recruitment/create-job-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Create job' };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ requirementId?: string }> }) {
  const auth = await getAuthContext();
  if (!auth) redirect('/login?next=/recruiter/jobs/new');
  if (auth.user.role !== 'RECRUITER') redirect(dashboardPathForRole(auth.user.role));
  if (!auth.user.emailVerifiedAt) redirect(`/verify-email?email=${encodeURIComponent(auth.user.email)}`);
  const { requirementId } = await searchParams;
  const linkedRequirement = requirementId ? await prisma.requirement.findFirst({ where: { id: requirementId, deletedAt: null }, select: { id: true, clientId: true } }) : null;
  const clients = await prisma.client.findMany({ where: { status: 'ACTIVE', deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  return <div className="min-h-screen bg-background"><header className="border-b border-border bg-card"><div className="container-page flex min-h-18 items-center justify-between"><Link href="/recruiter" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" />Back to dashboard</Link><h1 className="text-sm font-semibold">Create job</h1></div></header><main id="main-content" className="container-page max-w-3xl py-10"><Card><CardHeader><CardTitle>New job draft</CardTitle><p className="text-sm text-muted-foreground">Jobs start as drafts. Review the details before publishing to the public careers page.</p></CardHeader><CardContent>{clients.length ? <CreateJobForm clients={clients} initialClientId={linkedRequirement?.clientId ?? ''} initialRequirementId={linkedRequirement?.id ?? ''} /> : <p className="text-sm text-muted-foreground">An active client account is required before creating a job.</p>}</CardContent></Card></main></div>;
}
