'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

function messageFrom(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return 'We could not submit your application.';
  const error = payload.error;
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : 'We could not submit your application.';
}

export function ApplyForm({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const router = useRouter();
  const [coverLetter, setCoverLetter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/v1/applications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jobId, coverLetter }) });
      const payload: unknown = await response.json();
      if (!response.ok) { setError(messageFrom(payload)); return; }
      router.push('/candidate?applied=1');
      router.refresh();
    } catch { setError('The service is temporarily unavailable. Please try again.'); }
    finally { setLoading(false); }
  }

  return <form className="space-y-5" onSubmit={submit}>{error ? <Alert variant="destructive">{error}</Alert> : null}<div><p className="text-sm text-muted-foreground">Applying for</p><p className="mt-1 font-semibold">{jobTitle}</p></div><Field label="Cover letter" htmlFor="coverLetter" hint="Optional · tell the recruiter why this role fits"><Textarea id="coverLetter" rows={7} maxLength={5000} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} placeholder="Share a short note with the hiring team" /></Field><Button type="submit" className="w-full" size="lg" loading={loading}>Submit application</Button><p className="text-center text-xs text-muted-foreground">You can track this application from your candidate dashboard.</p></form>;
}
