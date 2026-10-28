// Building blocks for the project money views: KPI tiles, bar lists, budget
// meter and the money-in/money-out charts. Colours come from design tokens only.
import { type ReactNode } from 'react';
import { EmptyState } from '../../../components/states';
import { cn } from '../../../lib/cn';
import { formatCompact, formatMoney, formatMonth } from './format';

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <section className={cn('rounded-lg border border-border bg-surface p-4 sm:p-5', className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

type KpiTone = 'neutral' | 'positive' | 'negative' | 'warning';
const KPI_TONE: Record<KpiTone, string> = {
  neutral: 'text-ink',
  positive: 'text-success',
  negative: 'text-error',
  warning: 'text-warning',
};

export function KpiTile({
  label,
  value,
  hint,
  tone = 'neutral',
  onClick,
  active = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: KpiTone;
  onClick?: () => void;
  active?: boolean;
}): ReactNode {
  const body = (
    <>
      <span className="text-sm text-muted">{label}</span>
      <span className={cn('mt-1 block text-xl font-semibold tabular-nums', KPI_TONE[tone])}>
        {value}
      </span>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </>
  );
  const base = 'block w-full rounded-lg border bg-surface p-4 text-start';
  if (!onClick) return <div className={cn(base, 'border-border')}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        base,
        'transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        active ? 'border-brand ring-1 ring-brand' : 'border-border',
      )}
    >
      {body}
    </button>
  );
}

/** Spent against budget, with planned cost as a marker. */
export function BudgetMeter({
  budget,
  spent,
  planned,
  currency,
}: {
  budget: string | null;
  spent: string;
  planned?: string;
  currency: string;
}): ReactNode {
  if (budget === null || Number(budget) <= 0) {
    return (
      <p className="text-sm text-muted">No budget set · {formatMoney(spent, currency)} spent</p>
    );
  }
  const ratio = Number(spent) / Number(budget);
  const width = Math.min(ratio, 1) * 100;
  const plannedAt = planned ? Math.min(Number(planned) / Number(budget), 1) * 100 : null;
  const tone = ratio > 1 ? 'bg-error' : ratio >= 0.8 ? 'bg-warning' : 'bg-success';
  return (
    <div>
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-alt"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        aria-label="Budget used"
      >
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${width}%` }} />
        {plannedAt !== null && plannedAt > 0 ? (
          <span
            className="absolute top-0 h-full w-0.5 bg-ink"
            style={{ left: `${plannedAt}%` }}
            title="Planned cost"
          />
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted">
        {Math.round(ratio * 100)}% of {formatMoney(budget, currency)} used
        {planned && Number(planned) > 0 ? ` · planned ${formatMoney(planned, currency)}` : ''}
      </p>
    </div>
  );
}

export interface BarItem {
  key: string;
  label: string;
  value: number;
  display: string;
  secondary?: string;
}

/** Horizontal bars as buttons, so every bar is clickable and keyboard reachable. */
export function BarList({
  items,
  onSelect,
  selectedKey,
  emptyTitle = 'Nothing recorded yet',
  toneClass = 'bg-brand',
}: {
  items: readonly BarItem[];
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
  emptyTitle?: string;
  toneClass?: string;
}): ReactNode {
  const max = Math.max(...items.map((item) => item.value), 0);
  if (!items.length || max <= 0) return <EmptyState title={emptyTitle} />;
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-ink">{item.label}</span>
              <span className="shrink-0 tabular-nums text-ink">{item.display}</span>
            </span>
            <span className="mt-1 block h-2 w-full rounded-full bg-surface-alt">
              <span
                className={cn('block h-full rounded-full', toneClass)}
                style={{
                  width: item.value > 0 ? `${Math.max((item.value / max) * 100, 1)}%` : '0%',
                }}
              />
            </span>
            {item.secondary ? (
              <span className="mt-0.5 block text-xs text-muted">{item.secondary}</span>
            ) : null}
          </>
        );
        return (
          <li key={item.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                className={cn(
                  'w-full rounded-md p-2 text-start hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  selectedKey === item.key && 'bg-surface-alt',
                )}
              >
                {content}
              </button>
            ) : (
              <div className="p-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Legend({ items }: { items: { label: string; className: string }[] }): ReactNode {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-sm', item.className)} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Grouped monthly bars: money in vs money out. */
export function InOutChart({
  months,
  currency,
  onSelectMonth,
}: {
  months: readonly { month: string; moneyIn: string; moneyOut: string }[];
  currency: string;
  onSelectMonth?: (month: string) => void;
}): ReactNode {
  const values = months.flatMap((row) => [Number(row.moneyIn), Number(row.moneyOut)]);
  const max = Math.max(...values, 0);
  if (max <= 0) {
    return (
      <EmptyState
        title="No money movement yet"
        description="Payments and spending will appear here."
      />
    );
  }
  const width = 640;
  const height = 240;
  const pad = { t: 12, r: 8, b: 30, l: 52 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const slot = innerW / months.length;
  const barW = Math.max(3, Math.min(18, slot / 2 - 3));
  const y = (value: number) => pad.t + innerH - (value / max) * innerH;
  const ticks = [0, 0.5, 1].map((share) => share * max);
  return (
    <div className="space-y-2">
      <Legend
        items={[
          { label: 'Money in (payments)', className: 'bg-success' },
          { label: 'Money out (spending)', className: 'bg-error' },
        ]}
      />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-60 w-full"
        role="img"
        aria-label="Money in and money out by month"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
            />
            <text x={pad.l - 6} y={y(tick) + 4} textAnchor="end" className="fill-muted text-[10px]">
              {formatCompact(tick, currency)}
            </text>
          </g>
        ))}
        {months.map((row, index) => {
          const x = pad.l + index * slot + slot / 2;
          const moneyIn = Number(row.moneyIn);
          const moneyOut = Number(row.moneyOut);
          return (
            <g
              key={row.month}
              className={onSelectMonth ? 'cursor-pointer' : undefined}
              onClick={onSelectMonth ? () => onSelectMonth(row.month) : undefined}
            >
              <title>
                {`${formatMonth(row.month)} — in ${formatMoney(row.moneyIn, currency)}, out ${formatMoney(row.moneyOut, currency)}`}
              </title>
              <rect x={x - slot / 2} y={pad.t} width={slot} height={innerH} fill="transparent" />
              <rect
                x={x - barW - 1}
                y={y(moneyIn)}
                width={barW}
                height={pad.t + innerH - y(moneyIn)}
                rx="2"
                className="fill-success"
              />
              <rect
                x={x + 1}
                y={y(moneyOut)}
                width={barW}
                height={pad.t + innerH - y(moneyOut)}
                rx="2"
                className="fill-error"
              />
              <text x={x} y={height - 10} textAnchor="middle" className="fill-muted text-[10px]">
                {formatMonth(row.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Cumulative money in vs out over a project's life, with budget as a reference. */
export function CumulativeChart({
  timeline,
  budget,
  currency,
}: {
  timeline: readonly { month: string; cumulativeIn: string; cumulativeOut: string }[];
  budget: string | null;
  currency: string;
}): ReactNode {
  const values = timeline.flatMap((row) => [Number(row.cumulativeIn), Number(row.cumulativeOut)]);
  const budgetValue = budget ? Number(budget) : 0;
  const max = Math.max(...values, budgetValue, 0);
  if (max <= 0) return <EmptyState title="No money movement yet" />;
  const width = 640;
  const height = 240;
  const pad = { t: 12, r: 12, b: 30, l: 52 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (index: number) =>
    pad.l + (timeline.length === 1 ? innerW / 2 : (index / (timeline.length - 1)) * innerW);
  const y = (value: number) => pad.t + innerH - (value / max) * innerH;
  const line = (key: 'cumulativeIn' | 'cumulativeOut') =>
    timeline.map((row, index) => `${x(index)},${y(Number(row[key]))}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(timeline.length / 8));
  return (
    <div className="space-y-2">
      <Legend
        items={[
          { label: 'Collected (cumulative)', className: 'bg-success' },
          { label: 'Spent (cumulative)', className: 'bg-error' },
          ...(budgetValue > 0 ? [{ label: 'Budget', className: 'bg-warning' }] : []),
        ]}
      />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-60 w-full"
        role="img"
        aria-label="Cumulative money collected and spent"
      >
        {[0, 0.5, 1].map((share) => (
          <g key={share}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y(share * max)}
              y2={y(share * max)}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
            />
            <text
              x={pad.l - 6}
              y={y(share * max) + 4}
              textAnchor="end"
              className="fill-muted text-[10px]"
            >
              {formatCompact(share * max, currency)}
            </text>
          </g>
        ))}
        {budgetValue > 0 ? (
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={y(budgetValue)}
            y2={y(budgetValue)}
            stroke="var(--color-warning)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
        ) : null}
        <polyline
          points={line('cumulativeIn')}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <polyline
          points={line('cumulativeOut')}
          fill="none"
          stroke="var(--color-error)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {timeline.map((row, index) => (
          <g key={row.month}>
            <title>
              {`${formatMonth(row.month)} — collected ${formatMoney(row.cumulativeIn, currency)}, spent ${formatMoney(row.cumulativeOut, currency)}`}
            </title>
            <circle cx={x(index)} cy={y(Number(row.cumulativeIn))} r="3" className="fill-success" />
            <circle cx={x(index)} cy={y(Number(row.cumulativeOut))} r="3" className="fill-error" />
            {index % labelEvery === 0 || index === timeline.length - 1 ? (
              <text
                x={x(index)}
                y={height - 10}
                textAnchor="middle"
                className="fill-muted text-[10px]"
              >
                {formatMonth(row.month)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
