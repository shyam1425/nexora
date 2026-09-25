'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function PublishJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function publish() {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/v1/jobs/${jobId}/publish`, { method: 'POST' });
      if (!response.ok) { const body: unknown = await response.json().catch(() => null); const value = typeof body === 'object' && body !== null && 'error' in body ? body.error : null; setError(typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string' ? value.message : 'Unable to publish job.'); return; }
      router.refresh();
    } catch { setError('The service is temporarily unavailable. Please try again.'); }
    finally { setLoading(false); }
  }
  return <div className="space-y-3">{error ? <Alert variant="destructive">{error}</Alert> : null}<Button type="button" onClick={publish} loading={loading}>Publish to careers</Button></div>;
}
