import {
  PERMISSIONS,
  ROLES,
  TASK_STATUS_LABELS,
  TICKET_STATUS_LABELS,
  type AuthUser,
  type DashboardActivityItem,
  type DashboardFocus,
  type DashboardKpi,
  type DashboardModuleCount,
  type DashboardPayload,
  type DashboardRange,
  type DashboardUpcomingItem,
  type PermissionKey,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { bucketAmountsByDay, bucketByDay, computeTrend, resolvePeriod } from './dashboard.period';

const RECENT_LIMIT = 6;
const UPCOMING_DAYS = 30;
const ACTIVITY_LIMIT = 12;

function can(user: AuthUser, permission: PermissionKey): boolean {
  return user.permissions.includes(permission);
}

function isClientUser(user: AuthUser): boolean {
  return user.roles.includes(ROLES.CLIENT);
}

function dashboardFocus(user: AuthUser): DashboardFocus {
  if (isClientUser(user)) return 'client';
  const privileged = user.roles.some((role) =>
    ([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER] as string[]).includes(role),
  );
  if (privileged) return 'executive';
  if (user.roles.includes(ROLES.STAFF) && can(user, PERMISSIONS.TASKS_READ)) return 'staff';
  if (can(user, PERMISSIONS.CONTENT_READ) && !can(user, PERMISSIONS.PROJECTS_READ)) return 'editor';
  return 'executive';
}

function kpi(value: number, previous: number, context?: string): DashboardKpi {
  return { value, context, trend: computeTrend(value, previous) };
}

function money(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function scopedClientId(user: AuthUser): string | null {
  return isClientUser(user) ? user.clientId : null;
}

const ACTION_TITLES: Record<string, string> = {
  'document.create': 'Document uploaded',
  'document.delete': 'Document removed',
  'employee.create': 'Employee added',
  'employee.update': 'Employee updated',
  'leave.create': 'Leave request created',
  'leave.update': 'Leave request updated',
};

function activityHref(subjectType: string, subjectId: string | null): string | null {
  if (!subjectId) return null;
  if (subjectType === 'ClientDocument') return '/documents';
  if (subjectType === 'Employee') return '/employees';
  if (subjectType === 'LeaveRequest') return '/leave';
  if (subjectType === 'Project') return '/projects';
  if (subjectType === 'Task') return '/tasks';
  if (subjectType === 'Inquiry') return '/leads';
  if (subjectType === 'SupportTicket') return `/tickets/${subjectId}`;
  if (subjectType === 'Invoice') return `/invoices/${subjectId}`;
  return null;
}

export async function getDashboard(
  user: AuthUser,
  range: DashboardRange,
): Promise<DashboardPayload> {
  const period = resolvePeriod(range);
  const start = new Date(period.start);
  const end = new Date(period.end);
  const previousStart = new Date(period.previousStart);
  const previousEnd = new Date(period.previousEnd);
  const upcomingUntil = new Date(Date.now() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);
  const clientId = scopedClientId(user);

  if (isClientUser(user)) {
    return getClientDashboard(user, range, period, {
      start,
      end,
      previousStart,
      previousEnd,
      upcomingUntil,
      clientId,
    });
  }

  return getInternalDashboard(user, range, period, {
    start,
    end,
    previousStart,
    previousEnd,
    upcomingUntil,
  });
}

async function getClientDashboard(
  user: AuthUser,
  range: DashboardRange,
  period: DashboardPayload['period'],
  bounds: {
    start: Date;
    end: Date;
    previousStart: Date;
    previousEnd: Date;
    upcomingUntil: Date;
    clientId: string | null;
  },
): Promise<DashboardPayload> {
  const empty = emptyPayload('client', 'client', range, period);
  if (!bounds.clientId) return empty;

  const clientWhere = { clientId: bounds.clientId, deletedAt: null as Date | null };
  const [
    projects,
    previousProjects,
    tickets,
    previousOpenTickets,
    invoices,
    previousPending,
    previousRevenue,
    documents,
    previousDocuments,
    milestones,
  ] = await Promise.all([
    can(user, PERMISSIONS.PORTAL_READ)
      ? prisma.project.findMany({
          where: clientWhere,
          orderBy: { updatedAt: 'desc' },
          include: {
            manager: { select: { name: true } },
            client: { select: { companyName: true } },
          },
        })
      : Promise.resolve([]),
    can(user, PERMISSIONS.PORTAL_READ)
      ? prisma.project.count({
          where: {
            ...clientWhere,
            createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd },
          },
        })
      : Promise.resolve(0),
    can(user, PERMISSIONS.TICKETS_READ)
      ? prisma.supportTicket.findMany({
          where: clientWhere,
          orderBy: { createdAt: 'desc' },
          include: {
            client: { select: { companyName: true } },
            assignee: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    can(user, PERMISSIONS.TICKETS_READ)
      ? prisma.supportTicket.count({
          where: {
            ...clientWhere,
            status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
            createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd },
          },
        })
      : Promise.resolve(0),
    can(user, PERMISSIONS.INVOICES_READ)
      ? prisma.invoice.findMany({
          where: clientWhere,
          orderBy: { createdAt: 'desc' },
          include: { client: { select: { companyName: true } } },
        })
      : Promise.resolve([]),
    can(user, PERMISSIONS.INVOICES_READ)
      ? prisma.invoice.count({
          where: {
            ...clientWhere,
            status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
            createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd },
          },
        })
      : Promise.resolve(0),
    can(user, PERMISSIONS.INVOICES_READ)
      ? prisma.invoice.aggregate({
          where: {
            ...clientWhere,
            status: { not: 'VOID' },
            createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd },
          },
          _sum: { paidAmount: true },
        })
      : Promise.resolve({ _sum: { paidAmount: null } }),
    can(user, PERMISSIONS.DOCUMENTS_READ)
      ? prisma.clientDocument.findMany({
          where: { clientId: bounds.clientId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    can(user, PERMISSIONS.DOCUMENTS_READ)
      ? prisma.clientDocument.count({
          where: {
            clientId: bounds.clientId,
            deletedAt: null,
            createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd },
          },
        })
      : Promise.resolve(0),
    can(user, PERMISSIONS.PORTAL_READ)
      ? prisma.milestone.findMany({
          where: {
            deletedAt: null,
            status: { not: 'COMPLETED' },
            dueDate: { gte: bounds.start, lte: bounds.upcomingUntil },
            project: { clientId: bounds.clientId, deletedAt: null },
          },
          orderBy: { dueDate: 'asc' },
          take: 8,
          include: { project: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const openTickets = tickets.filter((row) => row.status !== 'RESOLVED');
  const pendingInvoices = invoices.filter((row) =>
    ['SENT', 'PARTIAL', 'OVERDUE'].includes(row.status),
  );
  const revenue = invoices
    .filter((row) => row.status !== 'VOID')
    .reduce((sum, row) => sum + money(row.paidAmount), 0);
  const prevRevenue = money(previousRevenue._sum.paidAmount ?? 0);

  const upcoming: DashboardUpcomingItem[] = [
    ...projects
      .filter(
        (row) => row.dueDate && row.dueDate >= bounds.start && row.dueDate <= bounds.upcomingUntil,
      )
      .map((row) => ({
        id: `project-${row.id}`,
        title: row.name,
        kind: 'project' as const,
        date: row.dueDate!.toISOString(),
        href: '/portal/projects',
        status: row.status,
      })),
    ...milestones
      .filter((row) => row.dueDate)
      .map((row) => ({
        id: `milestone-${row.id}`,
        title: `${row.title} · ${row.project.name}`,
        kind: 'milestone' as const,
        date: row.dueDate!.toISOString(),
        href: '/portal/milestones',
        status: row.status,
      })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  const activity: DashboardActivityItem[] = [
    ...projects.slice(0, 4).map((row) => ({
      id: `project-${row.id}`,
      title: 'Project updated',
      detail: row.name,
      createdAt: row.updatedAt.toISOString(),
      href: '/portal/projects',
    })),
    ...tickets.slice(0, 4).map((row) => ({
      id: `ticket-${row.id}`,
      title: 'Ticket received',
      detail: row.subject,
      createdAt: row.createdAt.toISOString(),
      href: `/tickets/${row.id}`,
    })),
    ...invoices.slice(0, 3).map((row) => ({
      id: `invoice-${row.id}`,
      title: 'Invoice issued',
      detail: row.number,
      createdAt: row.createdAt.toISOString(),
      href: `/invoices/${row.id}`,
    })),
    ...documents.slice(0, 3).map((row) => ({
      id: `document-${row.id}`,
      title: 'Document uploaded',
      detail: row.title,
      createdAt: row.createdAt.toISOString(),
      href: '/documents',
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, ACTIVITY_LIMIT);

  const modules: DashboardModuleCount[] = [];
  if (can(user, PERMISSIONS.PORTAL_READ) && user.clientId) {
    modules.push({ key: 'projects', to: '/portal/projects', count: projects.length });
    modules.push({ key: 'milestones', to: '/portal/milestones', count: milestones.length });
  }
  if (can(user, PERMISSIONS.TICKETS_READ)) {
    modules.push({ key: 'tickets', to: '/tickets', count: openTickets.length });
  }
  if (can(user, PERMISSIONS.INVOICES_READ)) {
    modules.push({ key: 'invoices', to: '/invoices', count: pendingInvoices.length });
  }
  if (can(user, PERMISSIONS.DOCUMENTS_READ)) {
    modules.push({ key: 'documents', to: '/documents', count: documents.length });
  }

  return {
    ...empty,
    kpis: {
      projects: can(user, PERMISSIONS.PORTAL_READ)
        ? kpi(
            projects.length,
            previousProjects,
            `${projects.filter((row) => row.status === 'ACTIVE').length} active`,
          )
        : undefined,
      openTickets: can(user, PERMISSIONS.TICKETS_READ)
        ? kpi(
            openTickets.length,
            previousOpenTickets,
            `${tickets.filter((row) => row.status === 'WAITING').length} waiting`,
          )
        : undefined,
      pendingInvoices: can(user, PERMISSIONS.INVOICES_READ)
        ? kpi(
            pendingInvoices.length,
            previousPending,
            `${invoices.filter((row) => row.status === 'OVERDUE').length} overdue`,
          )
        : undefined,
      revenue: can(user, PERMISSIONS.INVOICES_READ)
        ? kpi(Math.round(revenue * 100) / 100, prevRevenue)
        : undefined,
      documents: can(user, PERMISSIONS.DOCUMENTS_READ)
        ? kpi(documents.length, previousDocuments)
        : undefined,
    },
    ticketStatus: can(user, PERMISSIONS.TICKETS_READ)
      ? (['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED'] as const).map((key) => ({
          key,
          label: TICKET_STATUS_LABELS[key],
          value: tickets.filter((row) => row.status === key).length,
        }))
      : [],
    series: {
      projectActivity: can(user, PERMISSIONS.PORTAL_READ)
        ? bucketByDay(
            projects.map((row) => row.createdAt),
            period.start,
            period.end,
          )
        : [],
      leads: [],
      invoices: can(user, PERMISSIONS.INVOICES_READ)
        ? bucketAmountsByDay(
            invoices.map((row) => ({ date: row.createdAt, amount: money(row.total) })),
            period.start,
            period.end,
          )
        : [],
    },
    recent: {
      ...empty.recent,
      projects: projects.slice(0, RECENT_LIMIT).map((row) => ({
        id: row.id,
        name: row.name,
        clientName: row.client?.companyName ?? null,
        status: row.status,
        dueDate: row.dueDate?.toISOString() ?? null,
        ownerName: row.manager?.name ?? null,
        updatedAt: row.updatedAt.toISOString(),
        progress: null,
      })),
      tickets: tickets.slice(0, RECENT_LIMIT).map((row) => ({
        id: row.id,
        code: row.code,
        subject: row.subject,
        status: row.status,
        priority: row.priority,
        clientName: row.client.companyName,
        assigneeName: row.assignee?.name ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      invoices: invoices.slice(0, RECENT_LIMIT).map((row) => ({
        id: row.id,
        number: row.number,
        status: row.status,
        total: money(row.total).toFixed(2),
        paidAmount: money(row.paidAmount).toFixed(2),
        clientName: row.client.companyName,
        dueDate: row.dueDate.toISOString(),
      })),
      documents: documents.slice(0, RECENT_LIMIT).map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.createdAt.toISOString(),
      })),
    },
    upcoming,
    activity,
    modules,
  };
}

async function getInternalDashboard(
  user: AuthUser,
  range: DashboardRange,
  period: DashboardPayload['period'],
  bounds: { start: Date; end: Date; previousStart: Date; previousEnd: Date; upcomingUntil: Date },
): Promise<DashboardPayload> {
  const focus = dashboardFocus(user);
  const empty = emptyPayload('internal', focus, range, period);
  const staffOnly = focus === 'staff';

  const [
    projectStats,
    taskStats,
    leadStats,
    clientStats,
    ticketStats,
    invoiceStats,
    employeeCount,
    documentCount,
    applicationCount,
    recentProjects,
    recentTasks,
    recentLeads,
    recentTickets,
    upcomingProjects,
    upcomingMilestones,
    upcomingTasks,
    upcomingLeave,
    auditRows,
    contentCounts,
  ] = await Promise.all([
    can(user, PERMISSIONS.PROJECTS_READ) ? loadProjectStats(bounds) : null,
    can(user, PERMISSIONS.TASKS_READ) ? loadTaskStats(bounds, staffOnly ? user.id : null) : null,
    can(user, PERMISSIONS.LEADS_READ) ? loadLeadStats(bounds) : null,
    can(user, PERMISSIONS.CLIENTS_READ) ? loadClientStats(bounds) : null,
    can(user, PERMISSIONS.TICKETS_READ) ? loadTicketStats(bounds) : null,
    can(user, PERMISSIONS.INVOICES_READ) ? loadInvoiceStats(bounds) : null,
    can(user, PERMISSIONS.EMPLOYEES_READ)
      ? prisma.employee.count({ where: { deletedAt: null } })
      : Promise.resolve(null),
    can(user, PERMISSIONS.DOCUMENTS_READ)
      ? prisma.clientDocument.count({ where: { deletedAt: null } })
      : Promise.resolve(null),
    can(user, PERMISSIONS.APPLICATIONS_READ)
      ? prisma.jobApplication.count()
      : Promise.resolve(null),
    can(user, PERMISSIONS.PROJECTS_READ) ? loadRecentProjects() : Promise.resolve([]),
    can(user, PERMISSIONS.TASKS_READ)
      ? loadRecentTasks(staffOnly ? user.id : null)
      : Promise.resolve([]),
    can(user, PERMISSIONS.LEADS_READ) ? loadRecentLeads() : Promise.resolve([]),
    can(user, PERMISSIONS.TICKETS_READ) ? loadRecentTickets() : Promise.resolve([]),
    can(user, PERMISSIONS.PROJECTS_READ)
      ? prisma.project.findMany({
          where: {
            deletedAt: null,
            dueDate: { gte: bounds.start, lte: bounds.upcomingUntil },
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          orderBy: { dueDate: 'asc' },
          take: 6,
          select: { id: true, name: true, dueDate: true, status: true },
        })
      : Promise.resolve([]),
    can(user, PERMISSIONS.MILESTONES_READ)
      ? prisma.milestone.findMany({
          where: {
            deletedAt: null,
            status: { not: 'COMPLETED' },
            dueDate: { gte: bounds.start, lte: bounds.upcomingUntil },
          },
          orderBy: { dueDate: 'asc' },
          take: 6,
          include: { project: { select: { name: true } } },
        })
      : Promise.resolve([]),
    can(user, PERMISSIONS.TASKS_READ)
      ? prisma.task.findMany({
          where: {
            deletedAt: null,
            status: { not: 'DONE' },
            dueDate: { gte: bounds.start, lte: bounds.upcomingUntil },
            ...(staffOnly ? { assigneeId: user.id } : {}),
          },
          orderBy: { dueDate: 'asc' },
          take: 6,
          include: { project: { select: { name: true } } },
        })
      : Promise.resolve([]),
    can(user, PERMISSIONS.LEAVE_READ)
      ? prisma.leaveRequest.findMany({
          where: {
            deletedAt: null,
            status: { in: ['PENDING', 'APPROVED'] },
            startDate: { gte: bounds.start, lte: bounds.upcomingUntil },
          },
          orderBy: { startDate: 'asc' },
          take: 4,
          include: { employee: { include: { user: { select: { name: true } } } } },
        })
      : Promise.resolve([]),
    can(user, PERMISSIONS.AUDIT_READ)
      ? prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: ACTIVITY_LIMIT })
      : Promise.resolve([]),
    can(user, PERMISSIONS.CONTENT_READ) ? loadContentCounts() : Promise.resolve(null),
  ]);

  const upcoming: DashboardUpcomingItem[] = [
    ...upcomingProjects
      .filter((row) => row.dueDate)
      .map((row) => ({
        id: `project-${row.id}`,
        title: row.name,
        kind: 'project' as const,
        date: row.dueDate!.toISOString(),
        href: '/projects',
        status: row.status,
      })),
    ...upcomingMilestones
      .filter((row) => row.dueDate)
      .map((row) => ({
        id: `milestone-${row.id}`,
        title: `${row.title} · ${row.project.name}`,
        kind: 'milestone' as const,
        date: row.dueDate!.toISOString(),
        href: '/milestones',
        status: row.status,
      })),
    ...upcomingTasks
      .filter((row) => row.dueDate)
      .map((row) => ({
        id: `task-${row.id}`,
        title: `${row.title} · ${row.project.name}`,
        kind: 'task' as const,
        date: row.dueDate!.toISOString(),
        href: '/tasks',
        status: row.status,
      })),
    ...upcomingLeave.map((row) => ({
      id: `leave-${row.id}`,
      title: `${row.employee.user.name} · ${row.type}`,
      kind: 'leave' as const,
      date: row.startDate.toISOString(),
      href: '/leave',
      status: row.status,
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  const derivedActivity: DashboardActivityItem[] = [
    ...recentProjects.slice(0, 3).map((row) => ({
      id: `project-${row.id}`,
      title: 'Project created',
      detail: row.name,
      createdAt: row.updatedAt,
      href: '/projects',
    })),
    ...recentTasks.slice(0, 3).map((row) => ({
      id: `task-${row.id}`,
      title: 'Task created',
      detail: row.title,
      createdAt: row.createdAt,
      href: '/tasks',
    })),
    ...recentLeads.slice(0, 3).map((row) => ({
      id: `lead-${row.id}`,
      title: 'Lead received',
      detail: row.name,
      createdAt: row.createdAt,
      href: '/leads',
    })),
    ...recentTickets.slice(0, 3).map((row) => ({
      id: `ticket-${row.id}`,
      title: 'Ticket opened',
      detail: row.subject,
      createdAt: row.createdAt,
      href: `/tickets/${row.id}`,
    })),
  ];

  const activity: DashboardActivityItem[] =
    auditRows.length > 0
      ? auditRows.map((row) => ({
          id: row.id,
          title: ACTION_TITLES[row.action] ?? row.action.replace(/[._]/g, ' '),
          detail: row.subjectType,
          createdAt: row.createdAt.toISOString(),
          href: activityHref(row.subjectType, row.subjectId),
        }))
      : derivedActivity
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, ACTIVITY_LIMIT);

  const modules = buildModules(user, {
    projects: projectStats?.total ?? null,
    tasks: taskStats?.open ?? null,
    milestones: can(user, PERMISSIONS.MILESTONES_READ) ? upcomingMilestones.length : null,
    timesheets: null,
    clients: clientStats?.active ?? null,
    leads: leadStats?.open ?? null,
    tickets: ticketStats?.open ?? null,
    invoices: invoiceStats?.pending ?? null,
    employees: employeeCount,
    attendance: null,
    leave: can(user, PERMISSIONS.LEAVE_READ) ? upcomingLeave.length : null,
    applications: applicationCount,
    documents: documentCount,
    users: can(user, PERMISSIONS.USERS_READ) ? null : undefined,
    roles: can(user, PERMISSIONS.ROLES_READ) ? null : undefined,
    audit: can(user, PERMISSIONS.AUDIT_READ) ? auditRows.length : null,
    services: contentCounts?.services ?? null,
    posts: contentCounts?.posts ?? null,
  });

  return {
    ...empty,
    kpis: {
      projects: projectStats
        ? kpi(projectStats.total, projectStats.previousTotal, `${projectStats.active} active`)
        : undefined,
      activeProjects: projectStats
        ? kpi(projectStats.active, projectStats.previousActive)
        : undefined,
      openTasks: taskStats ? kpi(taskStats.open, taskStats.previousOpen) : undefined,
      openLeads: leadStats
        ? kpi(leadStats.open, leadStats.previousOpen, `${leadStats.total} total`)
        : undefined,
      activeClients: clientStats ? kpi(clientStats.active, clientStats.previousActive) : undefined,
      openTickets: ticketStats ? kpi(ticketStats.open, ticketStats.previousOpen) : undefined,
      pendingInvoices: invoiceStats
        ? kpi(invoiceStats.pending, invoiceStats.previousPending, `${invoiceStats.overdue} overdue`)
        : undefined,
      revenue: invoiceStats ? kpi(invoiceStats.revenue, invoiceStats.previousRevenue) : undefined,
      documents: documentCount !== null ? kpi(documentCount, 0) : undefined,
      employees: employeeCount !== null ? kpi(employeeCount, 0) : undefined,
      applications: applicationCount !== null ? kpi(applicationCount, 0) : undefined,
    },
    series: {
      projectActivity: projectStats
        ? bucketByDay(projectStats.createdInRange, period.start, period.end)
        : taskStats
          ? bucketByDay(taskStats.createdInRange, period.start, period.end)
          : [],
      leads: leadStats ? bucketByDay(leadStats.createdInRange, period.start, period.end) : [],
      invoices: invoiceStats
        ? bucketAmountsByDay(invoiceStats.createdInRange, period.start, period.end)
        : [],
    },
    taskStatus: taskStats
      ? (['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const).map((key) => ({
          key,
          label: TASK_STATUS_LABELS[key],
          value: taskStats.byStatus[key] ?? 0,
        }))
      : [],
    ticketStatus: ticketStats
      ? (['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED'] as const).map((key) => ({
          key,
          label: TICKET_STATUS_LABELS[key],
          value: ticketStats.byStatus[key] ?? 0,
        }))
      : [],
    recent: {
      ...empty.recent,
      projects: recentProjects,
      tasks: recentTasks,
      leads: recentLeads,
      tickets: recentTickets,
      invoices: invoiceStats?.recent ?? [],
    },
    upcoming,
    activity,
    modules,
  };
}

function emptyPayload(
  kind: DashboardPayload['kind'],
  focus: DashboardFocus,
  range: DashboardRange,
  period: DashboardPayload['period'],
): DashboardPayload {
  return {
    kind,
    focus,
    range,
    period,
    kpis: {},
    series: { projectActivity: [], leads: [], invoices: [] },
    taskStatus: [],
    ticketStatus: [],
    recent: { projects: [], tasks: [], leads: [], tickets: [], invoices: [], documents: [] },
    upcoming: [],
    activity: [],
    modules: [],
  };
}

async function loadProjectStats(bounds: {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}) {
  const [total, active, previousTotal, previousActive, created] = await Promise.all([
    prisma.project.count({ where: { deletedAt: null } }),
    prisma.project.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.project.count({
      where: { deletedAt: null, createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd } },
    }),
    prisma.project.count({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd },
      },
    }),
    prisma.project.findMany({
      where: { deletedAt: null, createdAt: { gte: bounds.start, lt: bounds.end } },
      select: { createdAt: true },
    }),
  ]);
  return {
    total,
    active,
    previousTotal,
    previousActive,
    createdInRange: created.map((row) => row.createdAt),
  };
}

async function loadTaskStats(
  bounds: { start: Date; end: Date; previousStart: Date; previousEnd: Date },
  assigneeId: string | null,
) {
  const scope = { deletedAt: null as Date | null, ...(assigneeId ? { assigneeId } : {}) };
  const [grouped, previousOpen, created] = await Promise.all([
    prisma.task.groupBy({
      by: ['status'],
      where: scope,
      _count: { _all: true },
    }),
    prisma.task.count({
      where: {
        ...scope,
        status: { not: 'DONE' },
        createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd },
      },
    }),
    prisma.task.findMany({
      where: { ...scope, createdAt: { gte: bounds.start, lt: bounds.end } },
      select: { createdAt: true },
    }),
  ]);
  const byStatus: Record<string, number> = {};
  for (const row of grouped) byStatus[row.status] = row._count._all;
  const open = (byStatus.TODO ?? 0) + (byStatus.IN_PROGRESS ?? 0) + (byStatus.IN_REVIEW ?? 0);
  return { open, previousOpen, byStatus, createdInRange: created.map((row) => row.createdAt) };
}

async function loadLeadStats(bounds: {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}) {
  const [total, open, previousOpen, created] = await Promise.all([
    prisma.inquiry.count(),
    prisma.inquiry.count({ where: { status: 'NEW' } }),
    prisma.inquiry.count({
      where: { status: 'NEW', createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd } },
    }),
    prisma.inquiry.findMany({
      where: { createdAt: { gte: bounds.start, lt: bounds.end } },
      select: { createdAt: true },
    }),
  ]);
  return { total, open, previousOpen, createdInRange: created.map((row) => row.createdAt) };
}

async function loadClientStats(bounds: { previousStart: Date; previousEnd: Date }) {
  const [active, previousActive] = await Promise.all([
    prisma.client.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.client.count({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd },
      },
    }),
  ]);
  return { active, previousActive };
}

async function loadTicketStats(bounds: { previousStart: Date; previousEnd: Date }) {
  const [grouped, previousOpen] = await Promise.all([
    prisma.supportTicket.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.supportTicket.count({
      where: {
        deletedAt: null,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
        createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd },
      },
    }),
  ]);
  const byStatus: Record<string, number> = {};
  for (const row of grouped) byStatus[row.status] = row._count._all;
  const open = (byStatus.OPEN ?? 0) + (byStatus.IN_PROGRESS ?? 0) + (byStatus.WAITING ?? 0);
  return { open, previousOpen, byStatus };
}

async function loadInvoiceStats(bounds: {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}) {
  const [rows, previousRows, recent] = await Promise.all([
    prisma.invoice.findMany({
      where: { deletedAt: null },
      select: { status: true, total: true, paidAmount: true, createdAt: true },
    }),
    prisma.invoice.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: bounds.previousStart, lt: bounds.previousEnd },
      },
      select: { status: true, paidAmount: true },
    }),
    prisma.invoice.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
      include: { client: { select: { companyName: true } } },
    }),
  ]);
  const pending = rows.filter((row) => ['SENT', 'PARTIAL', 'OVERDUE'].includes(row.status)).length;
  const overdue = rows.filter((row) => row.status === 'OVERDUE').length;
  const revenue = rows
    .filter((row) => row.status !== 'VOID')
    .reduce((sum, row) => sum + money(row.paidAmount), 0);
  const previousPending = previousRows.filter((row) =>
    ['SENT', 'PARTIAL', 'OVERDUE'].includes(row.status),
  ).length;
  const previousRevenue = previousRows.reduce((sum, row) => sum + money(row.paidAmount), 0);
  return {
    pending,
    overdue,
    previousPending,
    revenue: Math.round(revenue * 100) / 100,
    previousRevenue: Math.round(previousRevenue * 100) / 100,
    createdInRange: rows
      .filter((row) => row.createdAt >= bounds.start && row.createdAt < bounds.end)
      .map((row) => ({ date: row.createdAt, amount: money(row.total) })),
    recent: recent.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      total: money(row.total).toFixed(2),
      paidAmount: money(row.paidAmount).toFixed(2),
      clientName: row.client.companyName,
      dueDate: row.dueDate.toISOString(),
    })),
  };
}

async function loadRecentProjects(): Promise<DashboardPayload['recent']['projects']> {
  const rows = await prisma.project.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: RECENT_LIMIT,
    include: {
      client: { select: { companyName: true } },
      manager: { select: { name: true } },
      tasks: { where: { deletedAt: null }, select: { status: true } },
    },
  });
  return rows.map((row) => {
    const total = row.tasks.length;
    const done = row.tasks.filter((task) => task.status === 'DONE').length;
    return {
      id: row.id,
      name: row.name,
      clientName: row.client?.companyName ?? null,
      status: row.status,
      dueDate: row.dueDate?.toISOString() ?? null,
      ownerName: row.manager?.name ?? null,
      updatedAt: row.updatedAt.toISOString(),
      progress: total > 0 ? Math.round((done / total) * 100) : null,
    };
  });
}

async function loadRecentTasks(
  assigneeId: string | null,
): Promise<DashboardPayload['recent']['tasks']> {
  const rows = await prisma.task.findMany({
    where: { deletedAt: null, ...(assigneeId ? { assigneeId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: RECENT_LIMIT,
    include: { project: { select: { name: true } }, assignee: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    projectName: row.project.name,
    assigneeName: row.assignee?.name ?? null,
    priority: row.priority,
    status: row.status,
    dueDate: row.dueDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function loadRecentLeads(): Promise<DashboardPayload['recent']['leads']> {
  const rows = await prisma.inquiry.findMany({
    orderBy: { createdAt: 'desc' },
    take: RECENT_LIMIT,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    source: 'Website',
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function loadRecentTickets(): Promise<DashboardPayload['recent']['tickets']> {
  const rows = await prisma.supportTicket.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: RECENT_LIMIT,
    include: { client: { select: { companyName: true } }, assignee: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    clientName: row.client.companyName,
    assigneeName: row.assignee?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function loadContentCounts() {
  const [services, posts] = await Promise.all([prisma.service.count(), prisma.post.count()]);
  return { services, posts };
}

function buildModules(
  user: AuthUser,
  counts: Record<string, number | null | undefined>,
): DashboardModuleCount[] {
  const catalog: { key: string; to: string; permission: PermissionKey }[] = [
    { key: 'projects', to: '/projects', permission: PERMISSIONS.PROJECTS_READ },
    { key: 'tasks', to: '/tasks', permission: PERMISSIONS.TASKS_READ },
    { key: 'milestones', to: '/milestones', permission: PERMISSIONS.MILESTONES_READ },
    { key: 'timesheets', to: '/timesheets', permission: PERMISSIONS.TIMESHEETS_READ },
    { key: 'clients', to: '/clients', permission: PERMISSIONS.CLIENTS_READ },
    { key: 'leads', to: '/leads', permission: PERMISSIONS.LEADS_READ },
    { key: 'tickets', to: '/tickets', permission: PERMISSIONS.TICKETS_READ },
    { key: 'invoices', to: '/invoices', permission: PERMISSIONS.INVOICES_READ },
    { key: 'employees', to: '/employees', permission: PERMISSIONS.EMPLOYEES_READ },
    { key: 'attendance', to: '/attendance', permission: PERMISSIONS.ATTENDANCE_READ },
    { key: 'leave', to: '/leave', permission: PERMISSIONS.LEAVE_READ },
    { key: 'applications', to: '/applications', permission: PERMISSIONS.APPLICATIONS_READ },
    { key: 'documents', to: '/documents', permission: PERMISSIONS.DOCUMENTS_READ },
    { key: 'users', to: '/users', permission: PERMISSIONS.USERS_READ },
    { key: 'roles', to: '/roles', permission: PERMISSIONS.ROLES_READ },
    { key: 'audit', to: '/audit', permission: PERMISSIONS.AUDIT_READ },
    { key: 'services', to: '/cms/services', permission: PERMISSIONS.CONTENT_READ },
    { key: 'posts', to: '/cms/posts', permission: PERMISSIONS.CONTENT_READ },
  ];
  return catalog
    .filter((item) => can(user, item.permission))
    .map((item) => ({
      key: item.key,
      to: item.to,
      count: counts[item.key] === undefined ? null : (counts[item.key] ?? null),
    }));
}
