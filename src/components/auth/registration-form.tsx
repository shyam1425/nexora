'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type RegistrationKind = 'candidate' | 'client';

type RegistrationState = {
  firstName: string;
  lastName: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  city: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
};

const initialState: RegistrationState = {
  firstName: '', lastName: '', companyName: '', contactName: '', email: '',
  phone: '', industry: '', city: '', password: '', confirmPassword: '', acceptTerms: false,
};

function messageFrom(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return fallback;
  const error = payload.error;
  if (typeof error !== 'object' || error === null || !('message' in error)) return fallback;
  return typeof error.message === 'string' ? error.message : fallback;
}

export function RegistrationForm({ kind }: { kind: RegistrationKind }) {
  const router = useRouter();
  const [form, setForm] = useState<RegistrationState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setField<Key extends keyof RegistrationState>(key: Key, value: RegistrationState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const endpoint = kind === 'candidate' ? '/api/v1/auth/register/candidate' : '/api/v1/auth/register/client';
    const payload = kind === 'candidate'
      ? { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, password: form.password, confirmPassword: form.confirmPassword, acceptTerms: form.acceptTerms }
      : { companyName: form.companyName, contactName: form.contactName, email: form.email, phone: form.phone, industry: form.industry, city: form.city, password: form.password, confirmPassword: form.confirmPassword, acceptTerms: form.acceptTerms };

    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const responseBody: unknown = await response.json();
      if (!response.ok) {
        setError(messageFrom(responseBody, 'We could not create your account. Please review the form.'));
        return;
      }
      router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch {
      setError('The service is temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const candidate = kind === 'candidate';

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {candidate ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" required>
            <Input id="firstName" autoComplete="given-name" value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} required />
          </Field>
          <Field label="Last name" htmlFor="lastName" required>
            <Input id="lastName" autoComplete="family-name" value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} required />
          </Field>
        </div>
      ) : (
        <>
          <Field label="Company name" htmlFor="companyName" required>
            <Input id="companyName" autoComplete="organization" value={form.companyName} onChange={(event) => setField('companyName', event.target.value)} required />
          </Field>
          <Field label="Primary contact" htmlFor="contactName" required>
            <Input id="contactName" autoComplete="name" value={form.contactName} onChange={(event) => setField('contactName', event.target.value)} required />
          </Field>
        </>
      )}
      <Field label="Work email" htmlFor="email" required>
        <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={(event) => setField('email', event.target.value)} required />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone" hint="Optional">
          <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setField('phone', event.target.value)} />
        </Field>
        {!candidate ? (
          <Field label="Industry" htmlFor="industry" hint="Optional">
            <Input id="industry" value={form.industry} onChange={(event) => setField('industry', event.target.value)} />
          </Field>
        ) : null}
      </div>
      {!candidate ? (
        <Field label="City" htmlFor="city" hint="Optional">
          <Input id="city" autoComplete="address-level2" value={form.city} onChange={(event) => setField('city', event.target.value)} />
        </Field>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Password" htmlFor="password" required hint="10+ characters, upper/lowercase and a number">
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setField('password', event.target.value)} required />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" required>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setField('confirmPassword', event.target.value)} required />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-sm leading-5 text-muted-foreground">
        <input className="mt-0.5 size-4 rounded border-input accent-primary" type="checkbox" checked={form.acceptTerms} onChange={(event) => setField('acceptTerms', event.target.checked)} required />
        <span>I agree to the terms of service and privacy policy.</span>
      </label>
      <Button type="submit" className="w-full" size="lg" loading={loading}>Create account</Button>
      <p className="text-center text-xs text-muted-foreground">Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>
    </form>
  );
}

