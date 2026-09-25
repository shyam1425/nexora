import Link from 'next/link';
import { BriefcaseBusiness, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';

export const metadata = { title: 'Careers' };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const employmentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'] as const;
type EmploymentType = (typeof employmentTypes)[number];
function first(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }

export default async function CareersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 100);
  const location = first(params.location).trim().slice(0, 100);
  const employmentType = first(params.employmentType);
  const page = Math.max(1, Number(first(params.page)) || 1);
  const pageSize = 12;
  const where: Prisma.JobWhereInput = {
    status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null,
    AND: [
      ...(employmentTypes.includes(employmentType as EmploymentType) ? [{ employmentType: employmentType as EmploymentType }] : []),
      ...(location ? [{ OR: [{ location: { contains: location } }, { city: { contains: location } }, { state: { contains: location } }] }] : []),
      ...(query ? [{ OR: [{ title: { contains: query } }, { description: { contains: query } }, { skills: { string_contains: query } }] }] : []),
    ],
  };
  const [jobs, total] = await prisma.$transaction([
    prisma.job.findMany({ where, orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize, select: { id: true, slug: true, title: true, location: true, employmentType: true, workMode: true, minExperienceMonths: true, isFeatured: true, client: { select: { name: true } } } }),
    prisma.job.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="min-h-screen bg-background"><header className="border-b border-border bg-card"><div className="container-page flex min-h-18 items-center justify-between"><Link href="/" className="flex items-center gap-3 font-semibold text-primary"><span className="grid size-9 place-items-center rounded-xl bg-accent text-xs font-bold text-accent-foreground">360</span>WorkFox Tech</Link><div className="flex items-center gap-3"><Link href="/login" className="text-sm font-medium text-primary hover:underline">Sign in</Link><Button asChild size="sm"><Link href="/register/candidate">Create profile</Link></Button></div></div></header><main id="main-content" className="container-page space-y-8 py-10"><section className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Open opportunities</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Find work that moves you forward.</h1><p className="mt-4 text-muted-foreground">Search roles shared by teams building their next chapter.</p></section><form className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-[1fr_1fr_180px_auto]" method="get"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input name="q" defaultValue={query} placeholder="Role, skill, or keyword" className="pl-9" /></div><Input name="location" defaultValue={location} placeholder="City or location" /><select name="employmentType" defaultValue={employmentType} className="h-10 rounded-md border border-input bg-card px-3 text-sm"><option value="">All work types</option>{employmentTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select><Button type="submit"><SlidersHorizontal />Search</Button></form><div className="flex items-center justify-between text-sm text-muted-foreground"><p>{total} {total === 1 ? 'role' : 'roles'} found</p>{query || location || employmentType ? <Link href="/careers" className="font-medium text-primary hover:underline">Clear filters</Link> : null}</div>{jobs.length ? <div className="grid gap-4 md:grid-cols-2">{jobs.map((job) => <Card key={job.id} className="transition hover:border-primary/30 hover:shadow-md"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><BriefcaseBusiness className="size-5" /></div><Badge variant={job.isFeatured ? 'accent' : 'secondary'}>{job.isFeatured ? 'Featured' : job.employmentType.replaceAll('_', ' ')}</Badge></div><h2 className="mt-5 text-lg font-semibold"><Link href={`/careers/${job.slug}`} className="hover:text-primary">{job.title}</Link></h2><p className="mt-1 text-sm text-muted-foreground">{job.client.name}</p><div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="size-3" />{job.location ?? 'Location flexible'}</span><span>{job.workMode.replaceAll('_', ' ')}</span>{job.minExperienceMonths ? <span>{job.minExperienceMonths}+ months experience</span> : null}</div><Button asChild variant="outline" className="mt-5 w-full"><Link href={`/careers/${job.slug}`}>View role</Link></Button></CardContent></Card>)}</div> : <EmptyState title="No roles match those filters" description="Try a broader keyword or clear the filters to see all current opportunities." icon={<BriefcaseBusiness className="size-5" />} action={<Button asChild variant="outline"><Link href="/careers">Clear filters</Link></Button>} />}{totalPages > 1 ? <nav className="flex justify-center gap-2" aria-label="Jobs pagination">{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Button key={number} asChild size="sm" variant={number === page ? 'default' : 'outline'}><Link href={`/careers?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(location ? { location } : {}), ...(employmentType ? { employmentType } : {}), page: String(number) })}`}>{number}</Link></Button>)}</nav> : null}</main></div>
  );
}

