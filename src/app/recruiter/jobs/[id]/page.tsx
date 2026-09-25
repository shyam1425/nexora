import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';
import { ApplicationStatusActions } from '@/components/recruitment/application-status-actions';
import { CreateSubmissionForm } from '@/components/recruitment/create-submission-form';
import { PublishJobButton } from '@/components/recruitment/publish-job-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Manage job' };

export default async function ManageJobPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) redirect('/login?next=/recruiter');
  if (auth.user.role !== 'RECRUITER') redirect(dashboardPathForRole(auth.user.role));
  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, recruiterId: auth.user.id, deletedAt: null },
    include: {
      client: { select: { name: true } },
      submissions: { select: { candidateProfileId: true } },
      applications: {
        orderBy: { appliedAt: 'desc' },
        include: {
          candidateProfile: {
            select: { id: true, firstName: true, lastName: true, city: true, totalExperienceMonths: true },
          },
          interviews: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
              id: true,
              status: true,
              scheduledAt: true,
              durationMinutes: true,
              mode: true,
              roundName: true,
            },
          },
          offer: { select: { id: true, status: true, designation: true } },
          joining: { select: { id: true, status: true } },
        },
      },
    },
  });
  if (!job) notFound();
  const submittedCandidateIds = new Set(job.submissions.map((submission) => submission.candidateProfileId));
  const candidates = job.applications
    .filter((application) => !submittedCandidateIds.has(application.candidateProfile.id))
    .map((application) => ({
      id: application.candidateProfile.id,
      firstName: application.candidateProfile.firstName,
      lastName: application.candidateProfile.lastName,
      city: application.candidateProfile.city,
    }));
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card"><div className="container-page flex min-h-18 items-center justify-between"><Link href="/recruiter" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" />Back to dashboard</Link><span className="text-sm font-semibold">Manage job</span></div></header>
      <main id="main-content" className="container-page space-y-8 py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div><div className="flex flex-wrap gap-2"><Badge variant={job.status === 'PUBLISHED' ? 'success' : 'warning'}>{job.status}</Badge><Badge variant="secondary">{job.employmentType.replaceAll('_', ' ')}</Badge></div><h1 className="mt-4 text-3xl font-semibold tracking-tight">{job.title}</h1><p className="mt-2 text-muted-foreground">{job.client.name} · <MapPin className="inline size-3" /> {job.location ?? 'Location flexible'}</p></div>
          {job.status === 'DRAFT' ? <PublishJobButton jobId={job.id} /> : <Button asChild variant="outline"><Link href={`/careers/${job.slug}`}>View public role</Link></Button>}
        </div>
        <Card><CardHeader><CardTitle>Job details</CardTitle></CardHeader><CardContent className="grid gap-5 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Published</p><p className="mt-1 font-medium">{formatDate(job.publishedAt)}</p></div><div><p className="text-xs text-muted-foreground">Open positions</p><p className="mt-1 font-medium">{job.positionsCount}</p></div><div><p className="text-xs text-muted-foreground">Skills</p><p className="mt-1 font-medium">{Array.isArray(job.skills) && job.skills.length ? job.skills.join(', ') : 'Not specified'}</p></div></CardContent></Card>
        <CreateSubmissionForm clientId={job.clientId} jobId={job.id} requirementId={job.requirementId ?? ''} candidates={candidates} />
        <Card>
          <CardHeader><CardTitle>Applications ({job.applications.length})</CardTitle></CardHeader>
          <CardContent>{job.applications.length ? <div className="divide-y divide-border">{job.applications.map((application) => <div key={application.id} className="space-y-4 py-6 first:pt-0"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-medium">{application.candidateProfile.firstName} {application.candidateProfile.lastName}</p><p className="mt-1 text-xs text-muted-foreground">{application.candidateProfile.city ?? 'Location not specified'} · {application.candidateProfile.totalExperienceMonths} months experience · Applied {formatDate(application.appliedAt)}</p></div><Badge variant="info">{application.status.replaceAll('_', ' ')}</Badge></div><ApplicationStatusActions applicationId={application.id} status={application.status} workflow={{ interviews: application.interviews, offer: application.offer, joining: application.joining }} /></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">No applications yet.</p>}</CardContent>
        </Card>
      </main>
    </div>
  );
}
