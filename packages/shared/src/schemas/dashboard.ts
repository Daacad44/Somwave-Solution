import { z } from 'zod';
import { projectStatusSchema } from './project';
import { taskPrioritySchema, taskStatusSchema } from './task';
import { inquiryStatusSchema } from './inquiry';
import { ticketPrioritySchema, ticketStatusSchema } from './ticket';
import { invoiceStatusSchema } from './invoice';
import { milestoneStatusSchema } from './milestone';

export const DASHBOARD_RANGES = ['7d', '30d', 'this_month', 'last_month', 'this_year'] as const;
export const dashboardRangeSchema = z.enum(DASHBOARD_RANGES);
export type DashboardRange = z.infer<typeof dashboardRangeSchema>;

export const dashboardQuerySchema = z.object({
  range: dashboardRangeSchema.default('30d'),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const DASHBOARD_FOCUSES = ['client', 'editor', 'staff', 'executive'] as const;
export type DashboardFocus = (typeof DASHBOARD_FOCUSES)[number];

export interface DashboardPeriod {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
}

export interface DashboardTrend {
  current: number;
  previous: number;
  percent: number;
}

export interface DashboardKpi {
  value: number;
  context?: string;
  trend: DashboardTrend | null;
}

export interface DashboardPoint {
  date: string;
  value: number;
}

export interface DashboardStatusSlice {
  key: string;
  label: string;
  value: number;
}

export interface DashboardProjectRow {
  id: string;
  name: string;
  clientName: string | null;
  status: z.infer<typeof projectStatusSchema>;
  dueDate: string | null;
  ownerName: string | null;
  updatedAt: string;
  progress: number | null;
}

export interface DashboardTaskRow {
  id: string;
  title: string;
  projectName: string;
  assigneeName: string | null;
  priority: z.infer<typeof taskPrioritySchema>;
  status: z.infer<typeof taskStatusSchema>;
  dueDate: string | null;
  createdAt: string;
}

export interface DashboardLeadRow {
  id: string;
  name: string;
  email: string;
  source: string;
  status: z.infer<typeof inquiryStatusSchema>;
  createdAt: string;
}

export interface DashboardTicketRow {
  id: string;
  code: string;
  subject: string;
  status: z.infer<typeof ticketStatusSchema>;
  priority: z.infer<typeof ticketPrioritySchema>;
  clientName: string;
  assigneeName: string | null;
  createdAt: string;
}

export interface DashboardInvoiceRow {
  id: string;
  number: string;
  status: z.infer<typeof invoiceStatusSchema>;
  total: string;
  paidAmount: string;
  clientName: string;
  dueDate: string;
}

export interface DashboardDocumentRow {
  id: string;
  title: string;
  createdAt: string;
}

export interface DashboardUpcomingItem {
  id: string;
  title: string;
  kind: 'project' | 'milestone' | 'task' | 'leave';
  date: string;
  href: string;
  status?: z.infer<typeof milestoneStatusSchema> | string;
}

export interface DashboardActivityItem {
  id: string;
  title: string;
  detail: string | null;
  createdAt: string;
  href: string | null;
}

export interface DashboardModuleCount {
  key: string;
  to: string;
  count: number | null;
}

export interface DashboardPayload {
  kind: 'internal' | 'client';
  focus: DashboardFocus;
  range: DashboardRange;
  period: DashboardPeriod;
  kpis: {
    projects?: DashboardKpi;
    activeProjects?: DashboardKpi;
    openTasks?: DashboardKpi;
    openLeads?: DashboardKpi;
    activeClients?: DashboardKpi;
    openTickets?: DashboardKpi;
    pendingInvoices?: DashboardKpi;
    revenue?: DashboardKpi;
    documents?: DashboardKpi;
    employees?: DashboardKpi;
    applications?: DashboardKpi;
  };
  series: {
    projectActivity: DashboardPoint[];
    leads: DashboardPoint[];
    invoices: DashboardPoint[];
  };
  taskStatus: DashboardStatusSlice[];
  ticketStatus: DashboardStatusSlice[];
  recent: {
    projects: DashboardProjectRow[];
    tasks: DashboardTaskRow[];
    leads: DashboardLeadRow[];
    tickets: DashboardTicketRow[];
    invoices: DashboardInvoiceRow[];
    documents: DashboardDocumentRow[];
  };
  upcoming: DashboardUpcomingItem[];
  activity: DashboardActivityItem[];
  modules: DashboardModuleCount[];
}
