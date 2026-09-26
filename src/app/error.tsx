'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server has already logged the failure. Keep a correlatable trace on
    // the client without showing internals to the user.
    console.error('nexora_route_error', {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-background">
      <main
        id="main-content"
        className="container-page flex min-h-screen flex-col items-center justify-center gap-6 py-16 text-center"
      >
        <span className="grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </span>
        <div className="space-y-2" role="alert">
          <h1 className="text-2xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            We could not load this page. Try again — if it keeps failing, please
            come back in a few minutes.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => reset()}>
            <RotateCcw />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go to homepage</Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
      </main>
    </div>
  );
}
