'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function OfferResponseButtons({ offerId }: { offerId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'ACCEPT' | 'DECLINE' | null>(null);
  async function respond(decision: 'ACCEPT' | 'DECLINE') {
    setLoading(decision); setError(null);
    try {
      const response = await fetch(`/api/v1/offers/${offerId}/respond`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision }) });
      if (!response.ok) { const body: unknown = await response.json().catch(() => null); const value = typeof body === 'object' && body !== null && 'error' in body ? body.error : null; setError(typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string' ? value.message : 'Unable to record your response.'); return; }
      router.refresh();
    } catch { setError('The service is temporarily unavailable. Please try again.'); }
    finally { setLoading(null); }
  }
  return <div className="space-y-2">{error ? <Alert variant="destructive">{error}</Alert> : null}<div className="flex gap-2"><Button type="button" size="sm" onClick={() => respond('ACCEPT')} loading={loading === 'ACCEPT'}>Accept offer</Button><Button type="button" size="sm" variant="outline" onClick={() => respond('DECLINE')} loading={loading === 'DECLINE'}>Decline</Button></div></div>;
}
