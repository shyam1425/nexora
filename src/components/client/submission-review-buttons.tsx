'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import type { SubmissionStatusValue } from '@/lib/validation/recruitment';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/textarea';

type ReviewAction = {
  value: 'CLIENT_REVIEW' | 'CLIENT_SHORTLISTED' | 'CLIENT_REJECTED' | 'DROPPED';
  label: string;
};

const reviewActions: Partial<Record<SubmissionStatusValue, ReviewAction[]>> = {
  SUBMITTED: [
    { value: 'CLIENT_REVIEW', label: 'Start review' },
    { value: 'CLIENT_REJECTED', label: 'Reject' },
    { value: 'DROPPED', label: 'Drop' },
  ],
  CLIENT_REVIEW: [
    { value: 'CLIENT_SHORTLISTED', label: 'Shortlist' },
    { value: 'CLIENT_REJECTED', label: 'Reject' },
    { value: 'DROPPED', label: 'Drop' },
  ],
  CLIENT_SHORTLISTED: [{ value: 'DROPPED', label: 'Drop' }],
  INTERVIEW: [{ value: 'DROPPED', label: 'Drop' }],
  SELECTED: [{ value: 'DROPPED', label: 'Drop' }],
  OFFERED: [{ value: 'DROPPED', label: 'Drop' }],
};

function messageFrom(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return fallback;
  const error = payload.error;
  if (typeof error !== 'object' || error === null || !('message' in error)) return fallback;
  return typeof error.message === 'string' ? error.message : fallback;
}

export function SubmissionReviewButtons({
  submissionId,
  status,
  feedback,
}: {
  submissionId: string;
  status: SubmissionStatusValue;
  feedback: string | null;
}) {
  const router = useRouter();
  const availableActions = reviewActions[status] ?? [];
  const [nextStatus, setNextStatus] = useState<ReviewAction['value']>(availableActions[0]?.value ?? 'DROPPED');
  const [note, setNote] = useState(feedback ?? '');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/v1/submissions/${submissionId}/review`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, note }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(messageFrom(body, 'The submission could not be updated.'));
        return;
      }
      setMessage('Submission review saved.');
      router.refresh();
    } catch {
      setError('The service is temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!availableActions.length) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">Review complete</Badge><span>No further client action is available.</span></div>;
  }

  return (
    <form className="space-y-2" onSubmit={review}>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-40" label="Next decision" htmlFor={`review-status-${submissionId}`}>
          <Select id={`review-status-${submissionId}`} value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ReviewAction['value'])}>
            {availableActions.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}
          </Select>
        </Field>
        <Button type="submit" size="sm" loading={loading}>Save review</Button>
      </div>
      <Field label="Feedback" htmlFor={`review-note-${submissionId}`} hint="Shared with the assigned recruiter">
        <Textarea id={`review-note-${submissionId}`} value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={5000} placeholder="Add context for the recruitment team" />
      </Field>
    </form>
  );
}

