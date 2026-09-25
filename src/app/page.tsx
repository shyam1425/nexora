import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  FileCheck2,
  LockKeyhole,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const capabilities = [
  { icon: Building2, title: 'Client collaboration', description: 'Capture manpower requirements, align on submissions, and keep every hiring decision in one client-owned workspace.' },
  { icon: UsersRound, title: 'Candidate experience', description: 'Give candidates a private profile, resume, application history, interview updates, and offer response journey.' },
  { icon: BriefcaseBusiness, title: 'Recruiter operations', description: 'Publish roles, screen applicants, schedule interviews, record feedback, issue offers, and complete joining.' },
  { icon: FileCheck2, title: 'Employee foundation', description: 'Create an employee record at joining and keep private employee documents and service history connected.' },
];

const workflow = [
  ['01', 'Share the need', 'Clients publish clear role requirements for the recruitment team.'],
  ['02', 'Find and review', 'Recruiters work from real applications and candidate profiles.'],
  ['03', 'Interview with context', 'Schedule, complete, and audit every interview milestone.'],
  ['04', 'Close and onboard', 'Release an offer, record the response, and activate the employee.'],
];

const trustPoints = [
  'Role-based access on every protected operation',
  'Private document authorization and access logs',
  'Transaction-backed status, offer, and joining changes',
  'Persistent notifications and audit history',
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="container-page flex h-18 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight" aria-label="NEXORA home">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-lg shadow-primary/20">N</span>
            <span>NEXORA</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex" aria-label="Primary navigation">
            <Link href="#solutions" className="transition hover:text-foreground">Solutions</Link>
            <Link href="#workflow" className="transition hover:text-foreground">How it works</Link>
            <Link href="#security" className="transition hover:text-foreground">Security</Link>
            <Link href="/careers" className="transition hover:text-foreground">Careers</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/login">Sign in</Link></Button>
            <Button asChild size="sm"><Link href="/register/client">Get started<ArrowRight /></Link></Button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="relative border-b border-border bg-card">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(21,94,239,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,181,71,0.20),transparent_30%)]" />
          <div className="container-page relative grid min-h-[680px] items-center gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <div className="max-w-3xl">
              <Badge variant="info" className="mb-6 gap-2 px-3 py-1"><Sparkles className="size-3.5" />One connected workforce platform</Badge>
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl lg:text-7xl">Workforce.<br /><span className="text-primary">Recruitment.</span> People operations.</h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">Move from manpower requirement to a confident hire with one secure platform for clients, recruiters, candidates, and employees.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg"><Link href="/register/client">Build your team<ArrowRight /></Link></Button>
                <Button asChild size="lg" variant="outline"><Link href="/careers">Explore open roles</Link></Button>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                {trustPoints.slice(0, 3).map((point) => <span key={point} className="inline-flex items-center gap-2"><Check className="size-4 text-success" />{point}</span>)}
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
              <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl" />
              <Card className="overflow-hidden border-primary/15 shadow-2xl shadow-primary/10">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-4">
                    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Connected hiring</p><p className="mt-1 text-sm font-medium">Senior platform engineer</p></div>
                    <Badge variant="success">Interview scheduled</Badge>
                  </div>
                  <div className="space-y-5 p-5 sm:p-6">
                    {[
                      ['Application reviewed', 'Candidate profile and private resume available to the assigned recruiter.', 'Complete', 'success'],
                      ['Technical interview', 'Today · 15:30 · 45 minutes · secure video call', 'Scheduled', 'info'],
                      ['Offer response', 'Compensation and joining details ready for the candidate.', 'Awaiting candidate', 'warning'],
                    ].map(([title, detail, status, tone], index) => (
                      <div key={title} className="relative flex gap-4">
                        {index < 2 ? <span className="absolute left-[15px] top-9 h-[calc(100%+8px)] w-px bg-border" /> : null}
                        <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card text-xs font-bold text-primary">{index + 1}</span>
                        <div className="min-w-0 flex-1 rounded-lg border border-border bg-background p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{title}</p><Badge variant={tone as 'success' | 'info' | 'warning'}>{status}</Badge></div>
                          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-success" />Every milestone is persistent</span><span>Updated just now</span></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <section id="solutions" className="container-page scroll-mt-24 py-20 sm:py-28">
          <div className="max-w-2xl"><Badge variant="secondary">Built for the whole hiring team</Badge><h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">One system from first brief to first day.</h2><p className="mt-5 text-lg leading-8 text-muted-foreground">Replace disconnected tools and manual handoffs with role-specific workspaces connected by real business workflows.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="group h-full transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="p-6 sm:p-7"><span className="grid size-12 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-6" /></span><h3 className="mt-5 text-xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-muted-foreground">{description}</p><Link href="/register/candidate" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Learn more<ArrowRight className="size-4" /></Link></CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="workflow" className="scroll-mt-24 border-y border-border bg-primary text-primary-foreground">
          <div className="container-page grid gap-12 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
            <div><Badge className="border-white/20 bg-white/10 text-white">A connected workflow</Badge><h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">Every handoff has an owner.</h2><p className="mt-5 text-lg leading-8 text-primary-foreground/75">Business rules live on the server, changes are checked for concurrency, and every important transition creates a traceable history.</p><Button asChild size="lg" className="mt-8 bg-white text-primary hover:bg-white/90"><Link href="/register/client">Start a requirement<ArrowRight /></Link></Button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {workflow.map(([number, title, description]) => <div key={number} className="rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm"><p className="text-sm font-bold text-accent">{number}</p><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-primary-foreground/70">{description}</p></div>)}
            </div>
          </div>
        </section>

        <section id="security" className="container-page scroll-mt-24 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div><span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><LockKeyhole className="size-7" /></span><h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-5xl">Trust is an operating requirement.</h2><p className="mt-5 text-lg leading-8 text-muted-foreground">Candidate and employee information is sensitive. The platform is designed around authenticated sessions, server-side authorization, private storage, and durable audit records.</p></div>
            <Card><CardContent className="grid gap-5 p-6 sm:grid-cols-2">
              {[ShieldCheck, BadgeCheck, MessagesSquare, Workflow].map((Icon, index) => <div key={trustPoints[index]} className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-sm font-medium leading-6">{trustPoints[index]}</p></div>)}
            </CardContent></Card>
          </div>
        </section>

        <section className="container-page pb-20 sm:pb-28">
          <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-14 text-center text-background shadow-2xl sm:px-12 sm:py-20">
            <div className="absolute -right-16 -top-24 size-72 rounded-full bg-primary/40 blur-3xl" /><div className="absolute -bottom-24 -left-12 size-64 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative mx-auto max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Ready when your team is</p><h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">Build a hiring process everyone can trust.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-background/70">Create a client workspace, or join as a candidate and discover opportunities on the connected platform.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg" className="bg-white text-foreground hover:bg-white/90"><Link href="/register/client">Register your company</Link></Button><Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href="/register/candidate">Create candidate profile</Link></Button></div></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card"><div className="container-page flex flex-col gap-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3 font-semibold text-foreground"><span className="grid size-9 place-items-center rounded-lg bg-primary text-xs font-black text-primary-foreground">N</span>NEXORA</div><p>Workforce. Recruitment. HR solutions.</p><div className="flex gap-5"><Link href="/careers" className="hover:text-foreground">Careers</Link><Link href="/login" className="hover:text-foreground">Sign in</Link></div></div></footer>
    </div>
  );
}
