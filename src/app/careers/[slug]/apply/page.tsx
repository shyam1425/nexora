import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { ApplyForm } from '@/components/recruitment/apply-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Apply for role' };

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const auth = await getAuthContext();
  if (!auth) redirect(`/login?next=${encodeURIComponent(`/careers/${slug}/apply`)}`);
  if (auth.user.role !== 'CANDIDATE') redirect(dashboardPathForRole(auth.user.role));
  if (!auth.user.emailVerifiedAt) redirect(`/verify-email?email=${encodeURIComponent(auth.user.email)}`);
  const job = await prisma.job.findFirst({ where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null }, select: { id: true, title: true, client: { select: { name: true } } } });
  if (!job) notFound();

  return <div className="min-h-screen bg-background"><header className="border-b border-border bg-card"><div className="container-page flex min-h-18 items-center justify-between"><Link href={`/careers/${slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" />Back to role</Link><span className="text-sm font-semibold">Candidate application</span></div></header><main id="main-content" className="container-page max-w-2xl py-10"><Card><CardHeader><CardTitle>Apply for {job.title}</CardTitle><p className="text-sm text-muted-foreground">{job.client.name}</p></CardHeader><CardContent><ApplyForm jobId={job.id} jobTitle={job.title} /></CardContent></Card></main></div>;
}
