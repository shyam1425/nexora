'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import type {
  ApplicationStatus,
  InterviewStatus,
  JoiningStatus,
  OfferStatus,
} from '@/generated/prisma/enums';
import { formatDateTime } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, Textarea } from '@/components/ui/textarea';

type WorkflowState = {
  interviews: Array<{
    id: string;
    status: InterviewStatus;
    scheduledAt: Date | string;
    durationMinutes: number;
    mode: 'IN_PERSON' | 'VIDEO' | 'PHONE';
    roundName: string | null;
  }>;
  offer: { id: string; status: OfferStatus; designation: string } | null;
  joining: { id: string; status: JoiningStatus } | null;
};

type ManualAction = 'SCREENING' | 'SHORTLISTED' | 'SELECTED' | 'REJECTED';
type Action = ManualAction | 'SCHEDULE_INTERVIEW' | 'RECORD_FEEDBACK' | 'CREATE_OFFER' | 'COMPLETE_JOINING';

const manualActions: Partial<Record<ApplicationStatus, Array<{ value: ManualAction; label: string }>>> = {
  APPLIED: [{ value: 'SCREENING', label: 'Start screening' }, { value: 'REJECTED', label: 'Reject' }],
  SCREENING: [{ value: 'SHORTLISTED', label: 'Shortlist' }, { value: 'REJECTED', label: 'Reject' }],
  SHORTLISTED: [{ value: 'REJECTED', label: 'Reject' }],
  INTERVIEW_SCHEDULED: [{ value: 'REJECTED', label: 'Reject' }],
  INTERVIEW_COMPLETED: [{ value: 'SELECTED', label: 'Select candidate' }, { value: 'REJECTED', label: 'Reject' }],
  SELECTED: [{ value: 'REJECTED', label: 'Reject' }],
};

function messageFrom(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return fallback;
  const error = payload.error;
  if (typeof error !== 'object' || error === null || !('message' in error)) return fallback;
  return typeof error.message === 'string' ? error.message : fallback;
}

function datePayload(value: FormDataEntryValue | null): string {
  return typeof value === 'string' && value ? new Date(value).toISOString() : '';
}

export function ApplicationStatusActions({
  applicationId,
  status,
  workflow,
}: {
  applicationId: string;
  status: ApplicationStatus;
  workflow: WorkflowState;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function submit(path: string, method: string, body: unknown, action: Action, success: string, form?: HTMLFormElement) {
    setLoading(action); setError(null); setMessage(null);
    try {
      const response = await fetch(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(messageFrom(payload, 'The workflow action could not be completed.'));
        return;
      }
      form?.reset(); setNote(''); setMessage(success); router.refresh();
    } catch {
      setError('The service is temporarily unavailable. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  function updateManual(action: ManualAction) {
    return submit(
      `/api/v1/applications/${applicationId}/status`,
      'PATCH',
      { toStatus: action, note },
      action,
      `Application moved to ${action.toLowerCase().replaceAll('_', ' ')}.`,
    );
  }

  function scheduleInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    return submit('/api/v1/interviews', 'POST', {
      applicationId,
      scheduledAt: datePayload(data.get('scheduledAt')),
      durationMinutes: Number(data.get('durationMinutes')),
      mode: String(data.get('mode')),
      roundNumber: Number(data.get('roundNumber')),
      roundName: String(data.get('roundName') ?? ''),
      location: String(data.get('location') ?? ''),
      meetingLink: String(data.get('meetingLink') ?? ''),
      interviewerName: String(data.get('interviewerName') ?? ''),
      notes: String(data.get('notes') ?? ''),
    }, 'SCHEDULE_INTERVIEW', 'Interview scheduled and candidate notified.', form);
  }

  function recordFeedback(event: FormEvent<HTMLFormElement>, interviewId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const optionalNumber = (key: string) => {
      const value = data.get(key);
      return typeof value === 'string' && value ? Number(value) : undefined;
    };
    return submit(`/api/v1/interviews/${interviewId}/feedback`, 'POST', {
      overallRating: Number(data.get('overallRating')),
      technicalRating: optionalNumber('technicalRating'),
      communicationRating: optionalNumber('communicationRating'),
      recommendation: String(data.get('recommendation')),
      strengths: String(data.get('strengths') ?? ''),
      weaknesses: String(data.get('weaknesses') ?? ''),
      notes: String(data.get('notes') ?? ''),
    }, 'RECORD_FEEDBACK', 'Interview feedback recorded.', form);
  }

  function createOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const optionalValue = (key: string) => {
      const value = data.get(key);
      return typeof value === 'string' && value ? value : undefined;
    };
    return submit('/api/v1/offers', 'POST', {
      applicationId,
      designation: String(data.get('designation')),
      annualCtc: Number(data.get('annualCtc')),
      currency: String(data.get('currency')),
      joiningDate: datePayload(data.get('joiningDate')),
      validUntil: optionalValue('validUntil') ? datePayload(data.get('validUntil')) : undefined,
      probationMonths: optionalValue('probationMonths') ? Number(data.get('probationMonths')) : undefined,
      location: String(data.get('location') ?? ''),
      notes: String(data.get('notes') ?? ''),
    }, 'CREATE_OFFER', 'Offer released to the candidate.', form);
  }

  function completeJoining(event: FormEvent<HTMLFormElement>, joiningId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    return submit(`/api/v1/joinings/${joiningId}/complete`, 'PATCH', {
      actualJoiningDate: datePayload(data.get('actualJoiningDate')),
      notes: String(data.get('notes') ?? ''),
    }, 'COMPLETE_JOINING', 'Joining completed and employee profile created.', form);
  }

  const actions = manualActions[status] ?? [];
  const activeInterview = workflow.interviews.find(
    (item) => item.status === 'SCHEDULED' || item.status === 'RESCHEDULED',
  );

  return (
    <div className="w-full space-y-4">
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      {actions.length ? (
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="flex-1" label="Decision note" htmlFor={`note-${applicationId}`} hint="Optional context for status history">
              <Input id={`note-${applicationId}`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button key={action.value} type="button" variant={action.value === 'REJECTED' ? 'destructive' : 'default'} loading={loading === action.value} onClick={() => void updateManual(action.value)}>
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {status === 'SHORTLISTED' ? (
        <form onSubmit={scheduleInterview} className="rounded-lg border border-border bg-background p-4">
          <p className="mb-4 text-sm font-semibold">Schedule interview</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Date and time" htmlFor={`scheduledAt-${applicationId}`} required><Input id={`scheduledAt-${applicationId}`} name="scheduledAt" type="datetime-local" required /></Field>
            <Field label="Duration (minutes)" htmlFor={`duration-${applicationId}`} required><Input id={`duration-${applicationId}`} name="durationMinutes" type="number" min={15} max={480} defaultValue={45} required /></Field>
            <Field label="Mode" htmlFor={`mode-${applicationId}`} required><Select id={`mode-${applicationId}`} name="mode" defaultValue="VIDEO"><option value="VIDEO">Video</option><option value="PHONE">Phone</option><option value="IN_PERSON">In person</option></Select></Field>
            <Field label="Round number" htmlFor={`round-${applicationId}`} required><Input id={`round-${applicationId}`} name="roundNumber" type="number" min={1} defaultValue={1} required /></Field>
            <Field label="Round name" htmlFor={`roundName-${applicationId}`}><Input id={`roundName-${applicationId}`} name="roundName" placeholder="Technical interview" /></Field>
            <Field label="Interviewer" htmlFor={`interviewer-${applicationId}`}><Input id={`interviewer-${applicationId}`} name="interviewerName" /></Field>
            <Field label="Meeting link" htmlFor={`meeting-${applicationId}`}><Input id={`meeting-${applicationId}`} name="meetingLink" type="url" placeholder="https://meet.example/session" /></Field>
            <Field label="Location" htmlFor={`location-${applicationId}`}><Input id={`location-${applicationId}`} name="location" /></Field>
          </div>
          <Field className="mt-4" label="Notes" htmlFor={`interviewNotes-${applicationId}`}><Textarea id={`interviewNotes-${applicationId}`} name="notes" rows={3} /></Field>
          <Button className="mt-4" loading={loading === 'SCHEDULE_INTERVIEW'}>Schedule and notify candidate</Button>
        </form>
      ) : null}
      {status === 'INTERVIEW_SCHEDULED' && activeInterview ? (
        <div className="rounded-lg border border-info/25 bg-info/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Interview details</p><p className="mt-1 text-xs text-muted-foreground">{activeInterview.roundName ?? 'Interview'} · {formatDateTime(activeInterview.scheduledAt)} · {activeInterview.durationMinutes} minutes · {activeInterview.mode.replaceAll('_', ' ')}</p></div><Badge variant="info">{activeInterview.status}</Badge></div>
          <form id={`feedback-${activeInterview.id}`} className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void recordFeedback(event, activeInterview.id)}>
            <Field label="Overall rating" htmlFor={`overall-${activeInterview.id}`} required><Select id={`overall-${activeInterview.id}`} name="overallRating" defaultValue="4" required>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</Select></Field>
            <Field label="Recommendation" htmlFor={`recommendation-${activeInterview.id}`} required><Select id={`recommendation-${activeInterview.id}`} name="recommendation" defaultValue="YES"><option value="STRONG_YES">Strong yes</option><option value="YES">Yes</option><option value="NO">No</option><option value="STRONG_NO">Strong no</option></Select></Field>
            <Field label="Technical rating" htmlFor={`technical-${activeInterview.id}`}><Select id={`technical-${activeInterview.id}`} name="technicalRating" defaultValue="4">{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</Select></Field>
            <Field label="Communication rating" htmlFor={`communication-${activeInterview.id}`}><Select id={`communication-${activeInterview.id}`} name="communicationRating" defaultValue="4">{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</Select></Field>
            <Field label="Strengths" htmlFor={`strengths-${activeInterview.id}`}><Textarea id={`strengths-${activeInterview.id}`} name="strengths" rows={3} /></Field>
            <Field label="Weaknesses" htmlFor={`weaknesses-${activeInterview.id}`}><Textarea id={`weaknesses-${activeInterview.id}`} name="weaknesses" rows={3} /></Field>
          </form>
          <Button className="mt-4" type="submit" form={`feedback-${activeInterview.id}`} loading={loading === 'RECORD_FEEDBACK'}>Record feedback and complete interview</Button>
        </div>
      ) : null}
      {status === 'SELECTED' ? (
        <form onSubmit={createOffer} className="rounded-lg border border-border bg-background p-4">
          <p className="mb-4 text-sm font-semibold">Release offer</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Designation" htmlFor={`designation-${applicationId}`} required><Input id={`designation-${applicationId}`} name="designation" required /></Field>
            <Field label="Annual CTC" htmlFor={`ctc-${applicationId}`} required><Input id={`ctc-${applicationId}`} name="annualCtc" type="number" min={1} step="0.01" required /></Field>
            <Field label="Currency" htmlFor={`currency-${applicationId}`} required><Input id={`currency-${applicationId}`} name="currency" defaultValue="INR" minLength={3} maxLength={3} required /></Field>
            <Field label="Joining date" htmlFor={`joining-${applicationId}`} required><Input id={`joining-${applicationId}`} name="joiningDate" type="date" required /></Field>
            <Field label="Valid until" htmlFor={`validUntil-${applicationId}`}><Input id={`validUntil-${applicationId}`} name="validUntil" type="date" /></Field>
            <Field label="Probation (months)" htmlFor={`probation-${applicationId}`}><Input id={`probation-${applicationId}`} name="probationMonths" type="number" min={0} max={36} /></Field>
            <Field label="Location" htmlFor={`offerLocation-${applicationId}`}><Input id={`offerLocation-${applicationId}`} name="location" /></Field>
          </div>
          <Field className="mt-4" label="Notes" htmlFor={`offerNotes-${applicationId}`}><Textarea id={`offerNotes-${applicationId}`} name="notes" rows={3} /></Field>
          <Button className="mt-4" loading={loading === 'CREATE_OFFER'}>Create and send offer</Button>
        </form>
      ) : null}
      {status === 'OFFERED' ? (
        <div className="rounded-lg border border-warning/25 bg-warning/5 p-4 text-sm">
          Offer {workflow.offer?.status.toLowerCase() ?? 'sent'}. Waiting for the candidate response. Joining is created only after acceptance.
        </div>
      ) : null}
      {status === 'JOINING' && workflow.joining ? (
        <form onSubmit={(event) => void completeJoining(event, workflow.joining!.id)} className="rounded-lg border border-success/25 bg-success/5 p-4">
          <p className="text-sm font-semibold">Complete employee joining</p>
          <p className="mt-1 text-xs text-muted-foreground">This transaction activates the employee account and changes the application to joined.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Actual joining date" htmlFor={`actualJoining-${applicationId}`} required><Input id={`actualJoining-${applicationId}`} name="actualJoiningDate" type="date" required /></Field>
            <Field label="Joining notes" htmlFor={`joiningNotes-${applicationId}`}><Textarea id={`joiningNotes-${applicationId}`} name="notes" rows={3} /></Field>
          </div>
          <Button className="mt-4" loading={loading === 'COMPLETE_JOINING'}>Complete joining</Button>
        </form>
      ) : null}
    </div>
  );
}

