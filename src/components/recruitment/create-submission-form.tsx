'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, Textarea } from '@/components/ui/textarea';

function messageFrom(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return fallback;
  const error = payload.error;
  if (typeof error !== 'object' || error === null || !('message' in error)) return fallback;
  return typeof error.message === 'string' ? error.message : fallback;
}

export function CreateSubmissionForm({
  clientId,
  jobId,
  requirementId = '',
  candidates,
}: {
  clientId: string;
  jobId: string;
  requirementId?: string;
  candidates: Array<{ id: string; firstName: string; lastName: string; city: string | null }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      clientId,
      jobId,
      requirementId: String(data.get('requirementId') ?? ''),
      candidateProfileId: String(data.get('candidateProfileId') ?? ''),
      note: String(data.get('note') ?? ''),
    };
    try {
      const response = await fetch('/api/v1/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(messageFrom(body, 'The candidate could not be submitted.'));
        return;
      }
      form.reset();
      setMessage('Candidate submitted to the client.');
      router.refresh();
    } catch {
      setError('The service is temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <p className="text-sm font-semibold">Create a client submission</p>
      <p className="mt-1 text-xs text-muted-foreground">Only candidates with a real application for this job can be submitted. Assignment and client ownership are checked by the server.</p>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        {message ? <Alert variant="success">{message}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Candidate" htmlFor="candidateProfileId" required>
            <Select id="candidateProfileId" name="candidateProfileId" defaultValue="" required>
              <option value="" disabled>Select an applicant</option>
              {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.firstName} {candidate.lastName}{candidate.city ? ` · ${candidate.city}` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Requirement link" htmlFor="requirementId" hint="Optional">
            <Input id="requirementId" name="requirementId" defaultValue={requirementId} placeholder="Requirement ID" />
          </Field>
        </div>
        <Field label="Note to client" htmlFor="submissionNote" hint="Optional context for the client reviewer">
          <Textarea id="submissionNote" name="note" rows={3} maxLength={5000} />
        </Field>
        <Button type="submit" loading={loading} disabled={!candidates.length}>Submit candidate to client</Button>
        {!candidates.length ? <p className="text-xs text-muted-foreground">Candidates must apply to this job before they can be submitted.</p> : null}
      </form>
    </section>
  );
}
