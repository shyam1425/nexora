'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      router.replace('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return <Button type="button" variant="outline" size="sm" onClick={signOut} loading={loading}><LogOut />Sign out</Button>;
}
