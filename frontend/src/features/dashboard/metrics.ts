import type { DashboardKpi, DashboardMoneyKpi, ProjectStatus, TaskStatus } from '@somwave/shared';
import { trendFromCounts } from './trend';

export const PROJECT_STATUS_LABELS_EN: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const TASK_STATUS_LABELS_EN: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

export const TICKET_STATUS_LABELS_EN = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting for client',
  RESOLVED: 'Resolved',
} as const;

export const ACTIVITY_LABELS: Record<string, string> = {
  'employee.create': 'Employee added',
  'employee.update': 'Employee updated',
  'document.create': 'Document uploaded',
  'document.delete': 'Document removed',
};

export function formatRoleName(role: string): string {
  return role
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function projectProgress(taskTotal: number, taskDone: number): number | null {
  if (taskTotal <= 0) return null;
  return Math.round((taskDone / taskTotal) * 100);
}

export function kpiTrend(kpi: DashboardKpi | undefined): number | null {
  if (!kpi || kpi.previous === null) return null;
  return trendFromCounts(kpi.value, kpi.previous);
}

export function moneyTrend(kpi: DashboardMoneyKpi | undefined): number | null {
  if (!kpi || kpi.previous === null) return null;
  return trendFromCounts(Number(kpi.value), Number(kpi.previous));
}

export function activityLabel(action: string, subjectType: string): string {
  return ACTIVITY_LABELS[action] ?? `${subjectType} · ${action.replace(/\./g, ' ')}`;
}

export function hasSeriesValues(values: readonly { value: number }[]): boolean {
  return values.some((point) => point.value > 0);
}

export function hasMoneySeries(values: readonly { issued: number; paid: number }[]): boolean {
  return values.some((point) => point.issued > 0 || point.paid > 0);
}
