import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <main
        id="main-content"
        className="container-page flex min-h-screen flex-col items-center justify-center gap-6 py-16 text-center"
      >
        <span className="grid size-12 place-items-center rounded-xl bg-secondary text-primary">
          <Compass className="size-6" />
        </span>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            404
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            We could not find that page
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            The link may be out of date, or the role may have closed. Browse the
            latest openings instead.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/careers">Browse open roles</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go to homepage</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
