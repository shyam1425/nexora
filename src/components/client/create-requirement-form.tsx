'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function messageFrom(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return 'We could not submit the requirement.';
  const error = payload.error;
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : 'We could not submit the requirement.';
}

export function CreateRequirementForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = { title: String(form.get('title') ?? ''), description: String(form.get('description') ?? ''), skills: String(form.get('skills') ?? '').split(',').map((value) => value.trim()).filter(Boolean), positionsCount: Number(form.get('positionsCount') ?? 1), location: String(form.get('location') ?? ''), workMode: String(form.get('workMode') ?? 'ONSITE'), employmentType: String(form.get('employmentType') ?? 'FULL_TIME'), minExperienceMonths: form.get('minExperienceMonths') ? Number(form.get('minExperienceMonths')) : undefined, maxExperienceMonths: form.get('maxExperienceMonths') ? Number(form.get('maxExperienceMonths')) : undefined, budgetMin: form.get('budgetMin') ? Number(form.get('budgetMin')) : undefined, budgetMax: form.get('budgetMax') ? Number(form.get('budgetMax')) : undefined, priority: String(form.get('priority') ?? 'MEDIUM'), targetDate: String(form.get('targetDate') ?? '') || undefined };
    try {
      const response = await fetch('/api/v1/requirements', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body: unknown = await response.json();
      if (!response.ok) { setError(messageFrom(body)); return; }
      router.push('/client?created=1'); router.refresh();
    } catch { setError('The service is temporarily unavailable. Please try again.'); }
    finally { setLoading(false); }
  }
  return <form className="space-y-5" onSubmit={submit}>{error ? <Alert variant="destructive">{error}</Alert> : null}<Field label="Requirement title" htmlFor="title" required><Input id="title" name="title" required maxLength={160} placeholder="e.g. Senior Product Engineer" /></Field><Field label="Description" htmlFor="description" required hint="At least 20 characters"><Textarea id="description" name="description" required minLength={20} rows={6} placeholder="Describe the role, team, and outcomes" /></Field><Field label="Skills" htmlFor="skills" hint="Comma separated"><Input id="skills" name="skills" placeholder="React, TypeScript, SQL" /></Field><div className="grid gap-5 sm:grid-cols-3"><Field label="Open positions" htmlFor="positionsCount"><Input id="positionsCount" name="positionsCount" type="number" min={1} defaultValue={1} /></Field><Field label="Work mode" htmlFor="workMode"><select id="workMode" name="workMode" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="ONSITE">On-site</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option></select></Field><Field label="Employment" htmlFor="employmentType"><select id="employmentType" name="employmentType" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="INTERNSHIP">Internship</option></select></Field></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Location" htmlFor="location"><Input id="location" name="location" /></Field><Field label="Target date" htmlFor="targetDate"><Input id="targetDate" name="targetDate" type="date" /></Field></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Minimum experience (months)" htmlFor="minExperienceMonths"><Input id="minExperienceMonths" name="minExperienceMonths" type="number" min={0} /></Field><Field label="Maximum experience (months)" htmlFor="maxExperienceMonths"><Input id="maxExperienceMonths" name="maxExperienceMonths" type="number" min={0} /></Field></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Budget minimum" htmlFor="budgetMin"><Input id="budgetMin" name="budgetMin" type="number" min={0} /></Field><Field label="Budget maximum" htmlFor="budgetMax"><Input id="budgetMax" name="budgetMax" type="number" min={0} /></Field></div><Field label="Priority" htmlFor="priority"><select id="priority" name="priority" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></Field><Button type="submit" size="lg" className="w-full" loading={loading}>Submit requirement</Button></form>;
}
