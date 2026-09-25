import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** Current pathname, e.g. "/recruiter/jobs". */
  basePath: string;
  /** Existing query params to preserve when changing page. */
  params?: Record<string, string | undefined>;
  className?: string;
};

function buildHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  if (page > 1) query.set('page', String(page));
  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Server-rendered pagination: no client state, works without JavaScript. */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  basePath,
  params = {},
  className,
}: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-col items-center justify-between gap-3 sm:flex-row',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(basePath, params, page - 1)} rel="prev">
              <ChevronLeft className="size-4" /> Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="size-4" /> Previous
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(basePath, params, page + 1)} rel="next">
              Next <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}
