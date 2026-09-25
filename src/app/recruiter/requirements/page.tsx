import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Recruiter requirements' };

export default async function RecruiterRequirementsPage() {
  const auth = await getAuthContext();
  if (!auth) redirect('/login?next=/recruiter/requirements');
  if (auth.user.role !== 'RECRUITER') redirect(dashboardPathForRole(auth.user.role));
  const requirements = await prisma.requirement.findMany({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, deletedAt: null }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 50, include: { client: { select: { name: true } }, _count: { select: { jobs: true, submissions: true } } } });
  return <div className="min-h-screen bg-background"><header className="border-b border-border bg-card"><div className="container-page flex min-h-18 items-center justify-between"><Link href="/recruiter" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" />Back to dashboard</Link><SignOutButton /></div></header><main id="main-content" className="container-page space-y-8 py-10"><div><p className="text-sm text-muted-foreground">Client demand</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Open requirements</h1></div><Card><CardHeader><CardTitle>Requirements from clients</CardTitle></CardHeader><CardContent>{requirements.length ? <div className="divide-y divide-border">{requirements.map((requirement) => <div key={requirement.id} className="flex flex-col gap-4 py-5 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><div className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><BriefcaseBusiness className="size-5" /></div><div><p className="font-medium">{requirement.title}</p><p className="mt-1 text-xs text-muted-foreground">{requirement.client.name} · {requirement.positionsCount} position(s) · Created {formatDate(requirement.createdAt)}</p><p className="mt-1 text-xs text-muted-foreground">{requirement._count.jobs} linked job(s) · {requirement._count.submissions} submission(s)</p></div></div><div className="flex items-center gap-3"><Badge variant={requirement.priority === 'URGENT' ? 'destructive' : requirement.priority === 'HIGH' ? 'warning' : 'info'}>{requirement.priority}</Badge><Button asChild size="sm" variant="outline"><Link href={`/recruiter/jobs/new?requirementId=${requirement.id}`}>Create job</Link></Button></div></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">No open requirements.</p>}</CardContent></Card></main></div>;
}
