import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'info' | 'success' | 'warning' | 'destructive';

const variantStyles: Record<AlertVariant, string> = {
  info: 'border-info/30 bg-info/8 text-info',
  success: 'border-success/30 bg-success/8 text-success',
  warning: 'border-warning/30 bg-warning/8 text-warning',
  destructive: 'border-destructive/30 bg-destructive/8 text-destructive',
};

const icons: Record<AlertVariant, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
};

export type AlertProps = React.ComponentProps<'div'> & {
  variant?: AlertVariant;
  title?: string;
};

function Alert({ className, variant = 'info', title, children, ...props }: AlertProps) {
  const Icon = icons[variant];
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-md border p-3 text-sm',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? (
          <div className="text-foreground/80 [&_a]:underline">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

export { Alert };
