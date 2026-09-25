import { formatInTimeZone } from 'date-fns-tz';

/** Display timezone for all UI dates (SYSTEM_PROMPT §17). Storage remains UTC. */
export const DISPLAY_TIMEZONE = 'Africa/Mogadishu';

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '—';
  return formatInTimeZone(iso, DISPLAY_TIMEZONE, 'MMM d, yyyy');
}

export function greetingForNow(now = new Date()): string {
  const hour = Number(formatInTimeZone(now, DISPLAY_TIMEZONE, 'H'));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '—';
  return formatInTimeZone(iso, DISPLAY_TIMEZONE, 'yyyy-MM-dd');
}

export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '';
  return formatInTimeZone(iso, DISPLAY_TIMEZONE, 'yyyy-MM-dd');
}
