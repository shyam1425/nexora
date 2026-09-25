'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type ProfileFormValue = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  headline: string;
  summary: string;
  totalExperienceMonths: number;
  currentCtc: number | null;
  expectedCtc: number | null;
  noticePeriodDays: number | null;
  currentCompany: string;
  currentDesignation: string;
  skills: string[];
  linkedinUrl: string;
  portfolioUrl: string;
};

function messageFrom(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return 'We could not save your profile.';
  const error = payload.error;
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : 'We could not save your profile.';
}

function numberValue(value: FormDataEntryValue | null): number | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? null : Number(text);
}

export function EditProfileForm({ profile }: { profile: ProfileFormValue }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim();
    const payload = {
      firstName: text('firstName'),
      lastName: text('lastName'),
      phone: text('phone'),
      city: text('city'),
      state: text('state'),
      country: text('country'),
      headline: text('headline'),
      summary: text('summary'),
      totalExperienceMonths: Number(text('totalExperienceMonths') || 0),
      currentCtc: numberValue(form.get('currentCtc')),
      expectedCtc: numberValue(form.get('expectedCtc')),
      noticePeriodDays: numberValue(form.get('noticePeriodDays')),
      currentCompany: text('currentCompany'),
      currentDesignation: text('currentDesignation'),
      skills: text('skills').split(',').map((skill) => skill.trim()).filter(Boolean),
      linkedinUrl: text('linkedinUrl'),
      portfolioUrl: text('portfolioUrl'),
    };
    try {
      const response = await fetch('/api/v1/candidate/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) { setError(messageFrom(body)); return; }
      setMessage('Profile saved.'); router.refresh();
    } catch { setError('The service is temporarily unavailable. Please try again.'); }
    finally { setLoading(false); }
  }

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required><Input id="firstName" name="firstName" defaultValue={profile.firstName} autoComplete="given-name" required maxLength={80} /></Field>
        <Field label="Last name" htmlFor="lastName" required><Input id="lastName" name="lastName" defaultValue={profile.lastName} autoComplete="family-name" required maxLength={80} /></Field>
        <Field label="Phone" htmlFor="phone"><Input id="phone" name="phone" defaultValue={profile.phone} type="tel" autoComplete="tel" maxLength={20} /></Field>
        <Field label="Headline" htmlFor="headline"><Input id="headline" name="headline" defaultValue={profile.headline} maxLength={160} placeholder="Senior React Developer" /></Field>
        <Field label="City" htmlFor="city"><Input id="city" name="city" defaultValue={profile.city} autoComplete="address-level2" maxLength={100} /></Field>
        <Field label="State" htmlFor="state"><Input id="state" name="state" defaultValue={profile.state} autoComplete="address-level1" maxLength={100} /></Field>
        <Field label="Country" htmlFor="country"><Input id="country" name="country" defaultValue={profile.country} autoComplete="country-name" maxLength={100} /></Field>
        <Field label="Experience (months)" htmlFor="totalExperienceMonths"><Input id="totalExperienceMonths" name="totalExperienceMonths" type="number" min={0} max={600} defaultValue={profile.totalExperienceMonths} /></Field>
        <Field label="Current CTC" htmlFor="currentCtc" hint="Annual amount in INR"><Input id="currentCtc" name="currentCtc" type="number" min={0} step="0.01" defaultValue={profile.currentCtc ?? ''} /></Field>
        <Field label="Expected CTC" htmlFor="expectedCtc" hint="Annual amount in INR"><Input id="expectedCtc" name="expectedCtc" type="number" min={0} step="0.01" defaultValue={profile.expectedCtc ?? ''} /></Field>
        <Field label="Notice period (days)" htmlFor="noticePeriodDays"><Input id="noticePeriodDays" name="noticePeriodDays" type="number" min={0} max={365} defaultValue={profile.noticePeriodDays ?? ''} /></Field>
        <Field label="Current company" htmlFor="currentCompany"><Input id="currentCompany" name="currentCompany" defaultValue={profile.currentCompany} maxLength={160} /></Field>
        <Field label="Current designation" htmlFor="currentDesignation"><Input id="currentDesignation" name="currentDesignation" defaultValue={profile.currentDesignation} maxLength={160} /></Field>
        <Field label="Skills" htmlFor="skills" hint="Comma separated"><Input id="skills" name="skills" defaultValue={profile.skills.join(', ')} placeholder="React, TypeScript, Node.js" /></Field>
        <Field label="LinkedIn URL" htmlFor="linkedinUrl"><Input id="linkedinUrl" name="linkedinUrl" type="url" defaultValue={profile.linkedinUrl} maxLength={300} placeholder="https://linkedin.com/in/..." /></Field>
        <Field label="Portfolio URL" htmlFor="portfolioUrl"><Input id="portfolioUrl" name="portfolioUrl" type="url" defaultValue={profile.portfolioUrl} maxLength={300} placeholder="https://your-portfolio.com" /></Field>
      </div>
      <Field label="Professional summary" htmlFor="summary" hint="Optional · up to 5000 characters"><Textarea id="summary" name="summary" rows={5} maxLength={5000} defaultValue={profile.summary} placeholder="Tell recruiters about your experience and goals" /></Field>
      <Button type="submit" loading={loading}>Save profile</Button>
    </form>
  );
}
