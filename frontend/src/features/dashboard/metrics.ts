import type { InvoiceStatus, ProjectStatus, TaskStatus } from '@somwave/shared';

const OPEN_INVOICE_STATUSES = new Set<InvoiceStatus>(['DRAFT', 'SENT', 'PARTIAL', 'OVERDUE']);
const OPEN_TICKET_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'WAITING']);

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

export function formatRoleName(role: string): string {
  return role
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function countOpenTasks(total: number, done: number): number {
  return Math.max(0, total - done);
}

export function countLeads(leads: readonly { status: string }[]): { total: number; fresh: number } {
  return {
    total: leads.length,
    fresh: leads.filter((lead) => lead.status === 'NEW').length,
  };
}

export function countInvoices(invoices: readonly { status: InvoiceStatus }[]): {
  open: number;
  overdue: number;
} {
  return {
    open: invoices.filter((invoice) => OPEN_INVOICE_STATUSES.has(invoice.status)).length,
    overdue: invoices.filter((invoice) => invoice.status === 'OVERDUE').length,
  };
}

export function countOpenTickets(tickets: readonly { status: string }[]): number {
  return tickets.filter((ticket) => OPEN_TICKET_STATUSES.has(ticket.status)).length;
}
