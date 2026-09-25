import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Accessible form field wrapper: ties label, hint and error message together
 * and marks required inputs for screen readers.
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string | string[];
  children: ReactNode;
  className?: string;
}) {
  const errors = Array.isArray(error) ? error : error ? [error] : [];
  const describedBy = [
    hint ? `${htmlFor}-hint` : null,
    errors.length ? `${htmlFor}-error` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
        {label}
        {required ? (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div data-describedby={describedBy || undefined}>{children}</div>

      {hint && !errors.length ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {errors.length ? (
        <ul id={`${htmlFor}-error`} className="space-y-0.5" role="alert">
          {errors.map((message) => (
            <li key={message} className="text-xs font-medium text-destructive">
              {message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
