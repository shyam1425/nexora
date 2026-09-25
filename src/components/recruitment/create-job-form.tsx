'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function messageFrom(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return 'We could not create the job.';
  const error = payload.error;
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : 'We could not create the job.';
}

export function CreateJobForm({ clients, initialClientId = '', initialRequirementId = '' }: { clients: Array<{ id: string; name: string }>; initialClientId?: string; initialRequirementId?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = { clientId: String(form.get('clientId') ?? ''), requirementId: String(form.get('requirementId') ?? ''), title: String(form.get('title') ?? ''), description: String(form.get('description') ?? ''), responsibilities: String(form.get('responsibilities') ?? ''), requirements: String(form.get('requirements') ?? ''), skills: String(form.get('skills') ?? '').split(',').map((skill) => skill.trim()).filter(Boolean), employmentType: String(form.get('employmentType') ?? 'FULL_TIME'), workMode: String(form.get('workMode') ?? 'ONSITE'), location: String(form.get('location') ?? ''), city: String(form.get('city') ?? ''), state: String(form.get('state') ?? ''), positionsCount: Number(form.get('positionsCount') ?? 1), visibility: String(form.get('visibility') ?? 'PUBLIC') };
    try {
      const response = await fetch('/api/v1/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body: unknown = await response.json();
      if (!response.ok) { setError(messageFrom(body)); return; }
      router.push('/recruiter?created=1'); router.refresh();
    } catch { setError('The service is temporarily unavailable. Please try again.'); }
    finally { setLoading(false); }
  }

  return <form className="space-y-5" onSubmit={submit}>{error ? <Alert variant="destructive">{error}</Alert> : null}<Field label="Client" htmlFor="clientId" required><select id="clientId" name="clientId" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" required defaultValue={initialClientId}><option value="" disabled>Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field><Field label="Job title" htmlFor="title" required><Input id="title" name="title" required maxLength={160} placeholder="e.g. Senior React Developer" /></Field><Field label="Description" htmlFor="description" required hint="At least 20 characters"><Textarea id="description" name="description" required minLength={20} rows={6} placeholder="Describe the impact and responsibilities of this role" /></Field><Field label="Requirements" htmlFor="requirements" hint="Optional"><Textarea id="requirements" name="requirements" rows={5} placeholder="Must-have skills and qualifications" /></Field><Field label="Skills" htmlFor="skills" hint="Comma separated"><Input id="skills" name="skills" placeholder="React, TypeScript, Next.js" /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Employment type" htmlFor="employmentType" required><select id="employmentType" name="employmentType" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="INTERNSHIP">Internship</option><option value="FREELANCE">Freelance</option></select></Field><Field label="Work mode" htmlFor="workMode" required><select id="workMode" name="workMode" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="ONSITE">On-site</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option></select></Field></div><div className="grid gap-5 sm:grid-cols-3"><Field label="Location" htmlFor="location"><Input id="location" name="location" /></Field><Field label="City" htmlFor="city"><Input id="city" name="city" /></Field><Field label="Open positions" htmlFor="positionsCount"><Input id="positionsCount" name="positionsCount" type="number" min={1} defaultValue={1} /></Field></div><input type="hidden" name="requirementId" value={initialRequirementId} /><input type="hidden" name="visibility" value="PUBLIC" /><Button type="submit" size="lg" className="w-full" loading={loading}>Save draft job</Button></form>;
}
