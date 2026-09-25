'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function UploadResumeForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function upload() {
    if (!file) { setError('Choose a PDF, DOC, or DOCX resume first.'); return; }
    setLoading(true); setError(null); setMessage(null);
    const form = new FormData(); form.append('file', file); form.append('category', 'RESUME');
    try {
      const response = await fetch('/api/v1/documents', { method: 'POST', body: form });
      const body: unknown = await response.json();
      if (!response.ok) { const value = typeof body === 'object' && body !== null && 'error' in body ? body.error : null; setError(typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string' ? value.message : 'Resume upload failed.'); return; }
      setMessage('Resume uploaded securely.'); router.refresh();
    } catch { setError('The service is temporarily unavailable. Please try again.'); }
    finally { setLoading(false); }
  }
  return <div className="space-y-4">{error ? <Alert variant="destructive">{error}</Alert> : null}{message ? <Alert variant="success">{message}</Alert> : null}<Input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">PDF, DOC, or DOCX · maximum 10 MB · stored privately</p><Button type="button" onClick={upload} loading={loading}>Upload resume</Button></div>;
}
