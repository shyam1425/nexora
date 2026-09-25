import Link from 'next/link';
import type { ReactNode } from 'react';
import { BriefcaseBusiness, ShieldCheck, UsersRound } from 'lucide-react';

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main id="main-content" className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-primary px-10 py-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 size-96 rounded-full border border-white/10" />
        <div className="absolute -bottom-48 -left-24 size-[30rem] rounded-full border border-white/10" />
        <Link href="/" className="relative flex items-center gap-3 text-lg font-semibold tracking-tight">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground shadow-lg shadow-black/20">
            360
          </span>
          <span>WorkFox Tech</span>
        </Link>

        <div className="relative max-w-xl space-y-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">One connected workforce platform</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Move from manpower requirement to a confident hire.
          </h1>
          <p className="max-w-lg text-lg leading-8 text-primary-foreground/75">
            Bring recruitment, client collaboration, and employee operations into one secure workspace your whole team can trust.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <BriefcaseBusiness className="mb-3 size-5 text-accent" />
              <p className="text-sm font-medium">Recruitment</p>
              <p className="mt-1 text-xs text-primary-foreground/65">Track every application</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <UsersRound className="mb-3 size-5 text-accent" />
              <p className="text-sm font-medium">Client portal</p>
              <p className="mt-1 text-xs text-primary-foreground/65">Align every shortlist</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <ShieldCheck className="mb-3 size-5 text-accent" />
              <p className="text-sm font-medium">Private by design</p>
              <p className="mt-1 text-xs text-primary-foreground/65">Role-based access</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-primary-foreground/55">© 2026 360 WorkFox Tech. Built for real teams.</p>
      </section>

      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-16 lg:py-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-xs text-accent-foreground">360</span>
            WorkFox Tech
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">Back to website</Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <div className="mb-8 space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {children}
          <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">{footer}</div>
        </div>
      </section>
    </main>
  );
}
