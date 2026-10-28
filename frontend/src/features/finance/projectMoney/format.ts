import type { ProjectMoneyHealth } from '@somwave/shared';

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

const formatters = new Map<string, Intl.NumberFormat>();

/** Display-only formatting; arithmetic always happens on the server in decimals. */
export function formatMoney(amount: string | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return '—';
  let formatter = formatters.get(currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 });
    }
    formatters.set(currency, formatter);
  }
  return formatter.format(Number(amount));
}

export function formatCompact(amount: string | number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(amount));
  } catch {
    return String(amount);
  }
}

export function formatPercent(value: string | null): string {
  return value === null ? '—' : `${value}%`;
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Mogadishu',
  }).format(new Date(value));
}

export function formatMonth(month: string): string {
  const [year, value] = month.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, value - 1, 1)));
}

export function isNegative(amount: string | null): boolean {
  return amount !== null && Number(amount) < 0;
}

export const HEALTH: Record<ProjectMoneyHealth, { label: string; tone: Tone }> = {
  ON_TRACK: { label: 'On track', tone: 'success' },
  AT_RISK: { label: 'At risk', tone: 'warning' },
  OVER_BUDGET: { label: 'Over budget', tone: 'error' },
  NO_BUDGET: { label: 'No budget', tone: 'neutral' },
};

export function invoiceTone(status: string): Tone {
  if (status === 'PAID') return 'success';
  if (status === 'OVERDUE') return 'error';
  if (status === 'PARTIAL') return 'warning';
  if (status === 'SENT') return 'info';
  return 'neutral';
}

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
