import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.ComponentProps<'input'> & {
  error?: boolean;
};

function Input({ className, type = 'text', error, ...props }: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={error || undefined}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60',
        'file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium',
        error && 'border-destructive focus-visible:ring-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
