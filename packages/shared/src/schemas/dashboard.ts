import { z } from 'zod';
import type { InvoiceStatus } from './invoice';
import type { ProjectStatus } from './project';
import type { TaskPriority, TaskStatus } from './task';
import type { TicketStatus } from './ticket';

export const DASHBOARD_RANGES = [
  '7d',
  '30d',
  'this_month',
  'last_month',
  'this_year',
] as const;

export const dashboardRangeSchema = z.enum(DASHBOARD_RANGES);
export type DashboardRange = z.infer<typeof dashboardRangeSchema>;

export const dashboardQuerySchema = z.object({
  range: dashboardRangeSchema.default('30d'),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export type DashboardSurface = 'internal' | 'portal';

export interface DashboardKpi {
  value: number;
  previous: number | null;
}

export interface DashboardMoneyKpi {
  value: string;
  previous: string | null;
}

export interface DashboardSeriesPoint {
  date: string;
  value: number;
}

export interface DashboardMoneyPoint {
  date: string;
  issued: number;
  paid: number;
}

export interface DashboardRecentProject {
  id: string;
  name: string;
  status: ProjectStatus;
  dueDate: string | null;
  clientName: string | null;
  managerName: string | null;
  taskTotal: number;
  taskDone: number;
  updatedAt: string;
}

export interface DashboardRecentTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  projectName: string;
  assigneeName: string | null;
}

export interface DashboardRecentLead {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface DashboardRecentTicket {
  id: string;
  code: string;
  subject: string;
  status: TicketStatus;
  priority: string;
  createdAt: string;
  clientName: string;
  assigneeName: string | null;
}

export interface DashboardRecentInvoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  total: string;
  dueDate: string;
  clientName: string;
}

export interface DashboardUpcomingItem {
  id: string;
  kind: 'project' | 'milestone' | 'task' | 'leave';
  title: string;
  dueDate: string;
  href: string;
  meta: string | null;
}

export interface DashboardActivityItem {
  id: string;
  action: string;
  subjectType: string;
  subjectId: string | null;
  createdAt: string;
}

export interface DashboardModuleCount {
  key: string;
  count: number | null;
}

export interface DashboardOverview {
  surface: DashboardSurface;
  range: { key: DashboardRange; from: string; to: string };
  kpis: {
    projects?: DashboardKpi;
    activeProjects?: DashboardKpi;
    openTasks?: DashboardKpi;
    openLeads?: DashboardKpi;
    activeClients?: DashboardKpi;
    openTickets?: DashboardKpi;
    pendingInvoices?: DashboardKpi;
    revenue?: DashboardMoneyKpi;
    employees?: DashboardKpi;
    documents?: DashboardKpi;
    milestones?: DashboardKpi;
  };
  taskStatus: Partial<Record<TaskStatus, number>>;
  ticketStatus: Partial<Record<TicketStatus, number>>;
  series: {
    projects: DashboardSeriesPoint[];
    leads: DashboardSeriesPoint[];
    invoices: DashboardMoneyPoint[];
  };
  recent: {
    projects: DashboardRecentProject[];
    tasks: DashboardRecentTask[];
    leads: DashboardRecentLead[];
    tickets: DashboardRecentTicket[];
    invoices: DashboardRecentInvoice[];
  };
  upcoming: DashboardUpcomingItem[];
  activity: DashboardActivityItem[];
  modules: DashboardModuleCount[];
}
