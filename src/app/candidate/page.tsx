import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BriefcaseBusiness, CalendarDays, FileText, MapPin, UserRound } from 'lucide-react';
import { format } from 'date-fns';
import { getAuthContext } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { OfferResponseButtons } from '@/components/recruitment/offer-response-buttons';

export const metadata = { title: 'Candidate dashboard' };

function safeMeetingLink(value: string | null): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

export default async function CandidateDashboard() {
  const auth = await getAuthContext();
  if (!auth) redirect('/login?next=/candidate');
  if (auth.user.role !== 'CANDIDATE') redirect(dashboardPathForRole(auth.user.role));
  if (!auth.user.emailVerifiedAt) redirect(`/verify-email?email=${encodeURIComponent(auth.user.email)}`);

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: auth.user.id },
    include: {
      applications: {
        orderBy: { appliedAt: 'desc' },
        take: 8,
        include: {
          job: { select: { title: true, location: true, employmentType: true } },
          offer: { select: { id: true, status: true, designation: true, joiningDate: true } },
          interviews: {
            orderBy: { scheduledAt: 'asc' },
            select: { id: true, status: true, scheduledAt: true, durationMinutes: true, mode: true, roundNumber: true, roundName: true, location: true, meetingLink: true, interviewerName: true },
          },
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card"><div className="container-page flex min-h-18 items-center justify-between gap-4 py-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Candidate portal</p><h1 className="text-lg font-semibold">Welcome{auth.user.name ? `, ${auth.user.name.split(' ')[0]}` : ''}</h1></div><div className="flex items-center gap-2"><NotificationBell /><SignOutButton /></div></div></header>
      <main id="main-content" className="container-page space-y-8 py-8 sm:py-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">Your candidate workspace</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Keep your search moving.</h2></div><Button asChild variant="outline" className="w-fit"><Link href="/candidate/profile">Manage profile and resume</Link></Button></div>
        <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Profile completion</p><p className="mt-2 text-3xl font-semibold">{profile?.profileCompletion ?? 0}%</p><p className="mt-1 text-xs text-muted-foreground">Keep your details current</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Applications</p><p className="mt-2 text-3xl font-semibold">{profile?.applications.length ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">Recent activity shown below</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Resume</p><p className="mt-2 text-lg font-semibold">{profile?.resumeDocumentId ? 'Uploaded' : 'Not uploaded'}</p><p className="mt-1 text-xs text-muted-foreground">Private and recruiter-controlled</p></CardContent></Card></div>
        {!profile ? <Alert variant="warning">Your candidate profile is being prepared. Refresh this page in a moment.</Alert> : null}
        <Card id="applications"><CardHeader className="flex-row items-center justify-between"><CardTitle>Recent applications</CardTitle><span className="text-xs text-muted-foreground">{profile?.applications.length ?? 0} shown</span></CardHeader><CardContent>{profile?.applications.length ? <div className="divide-y divide-border">{profile.applications.map((application) => <div key={application.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><BriefcaseBusiness className="size-5" /></div><div><p className="font-medium">{application.job.title}</p><p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="size-3" />{application.job.location ?? 'Location not specified'}</span><span>{application.job.employmentType.replaceAll('_', ' ')}</span></p></div></div><div className="flex items-center gap-3 sm:flex-col sm:items-end"><Badge variant={application.status === 'REJECTED' || application.status === 'WITHDRAWN' ? 'destructive' : application.status === 'JOINED' ? 'success' : 'info'}>{application.status.replaceAll('_', ' ')}</Badge><span className="text-xs text-muted-foreground">Applied {format(application.appliedAt, 'd MMM yyyy')}</span>{application.offer?.status === 'SENT' ? <div className="mt-2 border-t pt-2"><p className="text-xs font-medium text-primary">Offer: {application.offer.designation}</p><OfferResponseButtons offerId={application.offer.id} /></div> : null}</div></div>)}</div> : <EmptyState title="No applications yet" description="Browse open roles and submit your first application when you are ready." icon={<FileText className="size-5" />} action={<Button asChild size="sm"><Link href="/careers">Browse jobs</Link></Button>} />}</CardContent></Card>
        <Card id="interviews"><CardHeader className="flex-row items-center justify-between"><CardTitle>Interview details</CardTitle><span className="text-xs text-muted-foreground">{profile?.applications.flatMap((application) => application.interviews).length ?? 0} scheduled</span></CardHeader><CardContent>{profile?.applications.flatMap((application) => application.interviews.map((interview) => ({ ...interview, jobTitle: application.job.title }))).length ? <div className="divide-y divide-border">{profile.applications.flatMap((application) => application.interviews.map((interview) => ({ ...interview, jobTitle: application.job.title }))).map((interview) => <div key={interview.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><CalendarDays className="size-5" /></div><div><p className="font-medium">{interview.jobTitle}</p><p className="mt-1 text-xs text-muted-foreground">Round {interview.roundNumber}{interview.roundName ? ` · ${interview.roundName}` : ''} · {interview.mode.replaceAll('_', ' ')} · {interview.durationMinutes} minutes</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(interview.scheduledAt)}</p>{interview.interviewerName ? <p className="mt-1 text-xs text-muted-foreground">Interviewer: {interview.interviewerName}</p> : null}{interview.location ? <p className="mt-1 text-xs text-muted-foreground">Location: {interview.location}</p> : null}{safeMeetingLink(interview.meetingLink) ? <a className="mt-1 inline-block text-xs font-medium text-primary hover:underline" href={safeMeetingLink(interview.meetingLink) ?? '#'} target="_blank" rel="noreferrer">Open meeting link</a> : null}</div></div><Badge variant={interview.status === 'CANCELLED' || interview.status === 'NO_SHOW' ? 'destructive' : interview.status === 'COMPLETED' ? 'success' : 'info'}>{interview.status.replaceAll('_', ' ')}</Badge></div>)}</div> : <EmptyState title="No interviews scheduled" description="When a recruiter schedules your interview, the details will appear here." icon={<CalendarDays className="size-5" />} />}</CardContent></Card>
        <Card><CardHeader><CardTitle>Profile snapshot</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm sm:grid-cols-3"><div className="flex gap-3"><UserRound className="size-4 text-primary" /><div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{profile ? `${profile.firstName} ${profile.lastName}` : 'Not available'}</p></div></div><div className="flex gap-3"><MapPin className="size-4 text-primary" /><div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{profile?.city ?? 'Add your location'}</p></div></div><div className="flex gap-3"><BriefcaseBusiness className="size-4 text-primary" /><div><p className="text-xs text-muted-foreground">Experience</p><p className="font-medium">{profile?.totalExperienceMonths ?? 0} months</p></div></div></CardContent></Card>
      </main>
    </div>
  );
}
