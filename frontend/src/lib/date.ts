import { formatInTimeZone } from 'date-fns-tz';

/** Display timezone for all UI dates (SYSTEM_PROMPT §17). Storage remains UTC. */
export const DISPLAY_TIMEZONE = 'Africa/Mogadishu';

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
