import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BriefcaseBusiness, CalendarClock, UsersRound } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Recruiter dashboard' };

export default async function RecruiterDashboard() {
  const auth = await getAuthContext();
  if (!auth) redirect('/login?next=/recruiter');
  if (auth.user.role !== 'RECRUITER') redirect(dashboardPathForRole(auth.user.role));
  if (!auth.user.emailVerifiedAt) redirect(`/verify-email?email=${encodeURIComponent(auth.user.email)}`);
  const [jobs, applicationCount, interviewCount, recentApplications] = await prisma.$transaction([
    prisma.job.findMany({ where: { recruiterId: auth.user.id, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 8, select: { id: true, title: true, slug: true, status: true, publishedAt: true, createdAt: true, updatedAt: true, _count: { select: { applications: true } } } }),
    prisma.application.count({ where: { job: { recruiterId: auth.user.id, deletedAt: null } } }),
    prisma.interview.count({ where: { application: { job: { recruiterId: auth.user.id, deletedAt: null } }, status: { in: ['SCHEDULED', 'RESCHEDULED'] } } }),
    prisma.application.findMany({ where: { job: { recruiterId: auth.user.id, deletedAt: null } }, orderBy: { appliedAt: 'desc' }, take: 6, select: { id: true, status: true, appliedAt: true, candidateProfile: { select: { firstName: true, lastName: true } }, job: { select: { title: true } } } }),
  ]);

  return <div className="min-h-screen bg-background"><header className="border-b border-border bg-card"><div className="container-page flex min-h-18 items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Recruitment workspace</p><h1 className="text-lg font-semibold">Welcome{auth.user.name ? `, ${auth.user.name.split(' ')[0]}` : ''}</h1></div><div className="flex items-center gap-2"><NotificationBell /><SignOutButton /></div></div></header><main id="main-content" className="container-page space-y-8 py-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">Recruiter dashboard</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Keep candidates moving.</h2></div><Button asChild><Link href="/recruiter/jobs/new">Create a job</Link></Button></div><div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><BriefcaseBusiness className="text-primary" /><p className="mt-4 text-3xl font-semibold">{jobs.length}</p><p className="text-sm text-muted-foreground">Assigned jobs</p></CardContent></Card><Card><CardContent className="p-5"><UsersRound className="text-primary" /><p className="mt-4 text-3xl font-semibold">{applicationCount}</p><p className="text-sm text-muted-foreground">Total applications</p></CardContent></Card><Card><CardContent className="p-5"><CalendarClock className="text-primary" /><p className="mt-4 text-3xl font-semibold">{interviewCount}</p><p className="text-sm text-muted-foreground">Upcoming interviews</p></CardContent></Card></div><div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Your jobs</CardTitle><Link href="/recruiter/jobs/new" className="text-sm font-medium text-primary hover:underline">New job</Link></CardHeader><CardContent>{jobs.length ? <div className="divide-y divide-border">{jobs.map((job) => <div key={job.id} className="flex items-center justify-between gap-4 py-4 first:pt-0"><div><Link href={`/recruiter/jobs/${job.id}`} className="font-medium hover:text-primary">{job.title}</Link><p className="mt-1 text-xs text-muted-foreground">{job._count.applications} applications · Updated {formatDate(job.updatedAt)}</p></div><Badge variant={job.status === 'PUBLISHED' ? 'success' : job.status === 'DRAFT' ? 'warning' : 'secondary'}>{job.status}</Badge></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">No jobs assigned yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Recent applications</CardTitle></CardHeader><CardContent>{recentApplications.length ? <div className="divide-y divide-border">{recentApplications.map((application) => <div key={application.id} className="py-4 first:pt-0"><div className="flex items-center justify-between gap-3"><p className="font-medium">{application.candidateProfile.firstName} {application.candidateProfile.lastName}</p><Badge variant="info">{application.status.replaceAll('_', ' ')}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{application.job.title} · {formatDate(application.appliedAt)}</p></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Applications will appear here.</p>}</CardContent></Card></div></main></div>;
}
