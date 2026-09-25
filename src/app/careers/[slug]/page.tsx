import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness, MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Role details' };

export default async function JobDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await prisma.job.findFirst({ where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null }, include: { client: { select: { name: true, industry: true, city: true } } } });
  if (!job) notFound();

  return (
    <div className="min-h-screen bg-background"><header className="border-b border-border bg-card"><div className="container-page flex min-h-18 items-center justify-between"><Link href="/careers" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" />Back to careers</Link><Button asChild size="sm"><Link href="/register/candidate">Create candidate profile</Link></Button></div></header><main id="main-content" className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px]"><article><div className="flex flex-wrap items-center gap-2"><Badge variant="info">{job.employmentType.replaceAll('_', ' ')}</Badge>{job.isFeatured ? <Badge variant="accent">Featured role</Badge> : null}</div><h1 className="mt-5 text-4xl font-semibold tracking-tight">{job.title}</h1><p className="mt-2 text-lg text-muted-foreground">{job.client.name}</p><div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="size-4" />{job.location ?? 'Location flexible'}</span><span>{job.workMode.replaceAll('_', ' ')}</span>{job.minExperienceMonths ? <span>{job.minExperienceMonths}+ months experience</span> : null}</div><div className="prose prose-slate mt-8 max-w-none whitespace-pre-wrap text-sm leading-7 text-foreground/80">{job.description}</div>{job.requirements ? <div className="mt-8"><h2 className="text-lg font-semibold">Requirements</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{job.requirements}</p></div> : null}</article><aside><Card className="sticky top-6"><CardHeader><CardTitle>Apply for this role</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">Create a candidate profile to submit your details and track this application.</p><Button asChild className="w-full"><Link href={`/careers/${job.slug}/apply`}>Apply for this role</Link></Button><Button asChild variant="outline" className="w-full"><Link href="/register/candidate">Create profile</Link></Button><p className="text-center text-xs text-muted-foreground">Your documents stay private and are shared only with authorized recruiters.</p></CardContent></Card><Card className="mt-4"><CardContent className="p-5"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><BriefcaseBusiness className="size-4" /></div><div><p className="text-sm font-semibold">{job.client.name}</p><p className="text-xs text-muted-foreground">{job.client.industry ?? 'Employer'}</p></div></div></CardContent></Card></aside></main></div>
  );
}
