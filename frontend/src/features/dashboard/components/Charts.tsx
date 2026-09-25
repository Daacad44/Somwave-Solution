import { type ReactNode } from 'react';
import type { DashboardPoint, DashboardStatusSlice } from '@somwave/shared';
import { cn } from '../../../lib/cn';
import { ChartEmpty } from './Widget';
import { seriesHasValues } from '../metrics';

const CHART_COLORS = [
  'var(--color-brand)',
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-info)',
];

export function AreaChart({
  points,
  label,
}: {
  points: readonly DashboardPoint[];
  label: string;
}): ReactNode {
  if (!seriesHasValues(points)) return <ChartEmpty />;
  const width = 560;
  const height = 220;
  const pad = { t: 16, r: 12, b: 28, l: 36 };
  const max = Math.max(...points.map((point) => point.value));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const coords = points.map((point, index) => {
    const x = pad.l + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad.t + innerH - (point.value / max) * innerH;
    return { x, y, point };
  });
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y}`).join(' ');
  const area = `${line} L${coords[coords.length - 1]?.x ?? pad.l} ${pad.t + innerH} L${coords[0]?.x ?? pad.l} ${pad.t + innerH} Z`;
  const ticks = coords.filter(
    (_, index) =>
      index === 0 || index === coords.length - 1 || index === Math.floor(coords.length / 2),
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label={label}>
      <path d={area} className="fill-brand-soft" />
      <path d={line} fill="none" className="stroke-brand" strokeWidth="2" />
      {ticks.map((tick) => (
        <text
          key={tick.point.date}
          x={tick.x}
          y={height - 8}
          textAnchor="middle"
          className="fill-muted text-[10px]"
        >
          {tick.point.date.slice(5)}
        </text>
      ))}
    </svg>
  );
}

export function BarChart({
  points,
  label,
}: {
  points: readonly DashboardPoint[];
  label: string;
}): ReactNode {
  if (!seriesHasValues(points)) return <ChartEmpty />;
  const width = 560;
  const height = 220;
  const pad = { t: 16, r: 12, b: 28, l: 12 };
  const max = Math.max(...points.map((point) => point.value));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const gap = 2;
  const barW = Math.max(2, innerW / points.length - gap);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label={label}>
      {points.map((point, index) => {
        const h = (point.value / max) * innerH;
        const x = pad.l + index * (barW + gap);
        const y = pad.t + innerH - h;
        return (
          <rect
            key={point.date}
            x={x}
            y={y}
            width={barW}
            height={Math.max(h, point.value > 0 ? 2 : 0)}
            className="fill-brand"
            rx="1"
          />
        );
      })}
    </svg>
  );
}

export function DonutChart({
  slices,
  label,
}: {
  slices: readonly DashboardStatusSlice[];
  label: string;
}): ReactNode {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return <ChartEmpty />;
  const size = 180;
  const r = 62;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-44 w-44" role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="fill-none stroke-canvas"
          strokeWidth="18"
        />
        {slices.map((slice, index) => {
          const len = (slice.value / total) * c;
          const dash = `${len} ${c - len}`;
          const node = (
            <circle
              key={slice.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth="18"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return node;
        })}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-ink text-lg font-semibold"
        >
          {total}
        </text>
      </svg>
      <ul className="flex w-full flex-col gap-2 text-sm">
        {slices.map((slice, index) => (
          <li key={slice.key} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-ink">
              <span
                className={cn('h-2.5 w-2.5 rounded-full')}
                style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                aria-hidden="true"
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
