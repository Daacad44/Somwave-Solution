import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { DashboardKpi } from '@somwave/shared';
import { Skeleton } from '../../../components/ui/Skeleton';
import { cn } from '../../../lib/cn';
import { formatTrend } from '../metrics';

export function KpiCard({
  label,
  to,
  icon: Icon,
  kpi,
  formatValue,
  isLoading,
  isError,
}: {
  label: string;
  to: string;
  icon: LucideIcon;
  kpi?: DashboardKpi;
  formatValue?: (value: number) => string;
  isLoading: boolean;
  isError: boolean;
}): ReactNode {
  return (
    <li>
      <Link
        to={to}
        className="flex h-full min-h-11 flex-col rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-muted">{label}</span>
        </div>
        {isLoading ? (
          <Skeleton className="mt-3 h-8 w-16" />
        ) : isError ? (
          <p className="mt-3 text-sm font-medium text-error">Xogta lama soo gelin karin.</p>
        ) : (
          <p className="mt-3 text-3xl font-semibold leading-none text-ink">
            {kpi ? (formatValue ? formatValue(kpi.value) : kpi.value) : '—'}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{kpi?.context ?? ' '}</p>
          {kpi?.trend ? (
            <span
              className={cn(
                'text-xs font-semibold',
                kpi.trend.percent > 0
                  ? 'text-success'
                  : kpi.trend.percent < 0
                    ? 'text-error'
                    : 'text-muted',
              )}
            >
              {formatTrend(kpi.trend.percent)}
              <span className="ms-1 font-normal text-muted">vs last period</span>
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
