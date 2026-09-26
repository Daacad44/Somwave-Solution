import { type ReactNode } from 'react';
import { EmptyState } from '../../components/states';
import { cn } from '../../lib/cn';

const EMPTY = 'There is not enough activity in this range to draw the chart yet.';

export function AreaChart({
  points,
  label,
}: {
  points: readonly { date: string; value: number }[];
  label: string;
}): ReactNode {
  if (!points.some((point) => point.value > 0)) {
    return <EmptyState title="No data yet" description={EMPTY} />;
  }
  const width = 560;
  const height = 220;
  const pad = { t: 12, r: 8, b: 28, l: 28 };
  const max = Math.max(...points.map((point) => point.value), 1);
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const coords = points.map((point, index) => {
    const x = pad.l + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad.t + innerH - (point.value / max) * innerH;
    return `${x},${y}`;
  });
  const line = coords.join(' ');
  const area = `${pad.l},${pad.t + innerH} ${line} ${pad.l + innerW},${pad.t + innerH}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label={label}>
      <polyline points={area} fill="var(--color-brand-soft)" stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DonutChart({
  slices,
  label,
}: {
  slices: readonly { key: string; label: string; value: number; className: string }[];
  label: string;
}): ReactNode {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) {
    return <EmptyState title="No data yet" description={EMPTY} />;
  }
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 120 120" className="h-40 w-40" role="img" aria-label={label}>
        {slices.map((slice) => {
          const length = (slice.value / total) * circ;
          const dash = `${length} ${circ - length}`;
          const current = offset;
          offset += length;
          return (
            <circle
              key={slice.key}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              strokeDasharray={dash}
              strokeDashoffset={-current}
              className={slice.className}
              transform="rotate(-90 60 60)"
            />
          );
        })}
        <text x="60" y="64" textAnchor="middle" className="fill-ink text-lg font-semibold">
          {total}
        </text>
      </svg>
      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted">
              <span
                className={cn('h-2.5 w-2.5 rounded-full', slice.className.replace('text-', 'bg-'))}
              />
              {slice.label}
            </span>
            <span className="font-medium text-ink">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarChart({
  points,
  label,
}: {
  points: readonly { date: string; value: number }[];
  label: string;
}): ReactNode {
  if (!points.some((point) => point.value > 0)) {
    return <EmptyState title="No data yet" description={EMPTY} />;
  }
  const width = 560;
  const height = 220;
  const pad = { t: 12, r: 8, b: 28, l: 8 };
  const max = Math.max(...points.map((point) => point.value), 1);
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const barW = Math.max(2, innerW / points.length - 2);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label={label}>
      {points.map((point, index) => {
        const h = (point.value / max) * innerH;
        const x = pad.l + index * (innerW / points.length);
        const y = pad.t + innerH - h;
        return (
          <rect
            key={point.date}
            x={x}
            y={y}
            width={barW}
            height={Math.max(h, 0)}
            rx="2"
            className="fill-brand"
          />
        );
      })}
    </svg>
  );
}

export function InvoiceChart({
  points,
  label,
}: {
  points: readonly { date: string; issued: number; paid: number }[];
  label: string;
}): ReactNode {
  if (!points.some((point) => point.issued > 0 || point.paid > 0)) {
    return <EmptyState title="No data yet" description={EMPTY} />;
  }
  const width = 560;
  const height = 220;
  const pad = { t: 12, r: 8, b: 28, l: 28 };
  const max = Math.max(...points.flatMap((point) => [point.issued, point.paid]), 1);
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const line = (values: number[]): string =>
    values
      .map((value, index) => {
        const x =
          pad.l + (values.length === 1 ? innerW / 2 : (index / (values.length - 1)) * innerW);
        const y = pad.t + innerH - (value / max) * innerH;
        return `${x},${y}`;
      })
      .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label={label}>
      <polyline
        points={line(points.map((point) => point.issued))}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="2"
      />
      <polyline
        points={line(points.map((point) => point.paid))}
        fill="none"
        stroke="var(--color-success)"
        strokeWidth="2"
      />
    </svg>
  );
}
