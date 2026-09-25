import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/states';

export function Widget({
  title,
  action,
  children,
}: {
  title: string;
  action?: { to: string; label: string };
  children: ReactNode;
}): ReactNode {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {action ? (
          <Link
            to={action.to}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {action.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="mt-4 min-w-0 flex-1">{children}</div>
    </section>
  );
}

export function WidgetSkeleton({ rows = 4 }: { rows?: number }): ReactNode {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function WidgetError({ onRetry }: { onRetry: () => void }): ReactNode {
  return (
    <ErrorState
      title="Xogta lama soo gelin karin."
      retryLabel="Isku day mar kale"
      onRetry={onRetry}
    />
  );
}

export function WidgetEmpty({ children = 'Wax xog ah lama hayo.' }: { children?: ReactNode }): ReactNode {
  return <p className="text-sm text-muted">{children}</p>;
}

export function ChartEmpty(): ReactNode {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg bg-canvas px-4 text-center">
      <p className="text-sm font-medium text-ink">No data yet</p>
      <p className="mt-1 text-sm text-muted">
        Xog ku filan oo lagu sameeyo jaantuskan weli ma jirto.
      </p>
    </div>
  );
}
