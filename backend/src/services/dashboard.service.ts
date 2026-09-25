import { Prisma } from '@prisma/client';
import {
  PERMISSIONS,
  ROLES,
  type AuthUser,
  type DashboardActivityItem,
  type DashboardKpi,
  type DashboardMoneyKpi,
  type DashboardMoneyPoint,
  type DashboardOverview,
  type DashboardRange,
  type DashboardRecentInvoice,
  type DashboardRecentLead,
  type DashboardRecentProject,
  type DashboardRecentTask,
  type DashboardRecentTicket,
  type DashboardSeriesPoint,
  type DashboardUpcomingItem,
  type PermissionKey,
  type TaskStatus,
  type TicketStatus,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';

const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // Africa/Mogadishu is UTC+3 year-round
const OPEN_INVOICE = ['DRAFT', 'SENT', 'PARTIAL', 'OVERDUE'] as const;
const OPEN_TASK: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'];
const OPEN_TICKET: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING'];
const INTERNAL_SURFACE: PermissionKey[] = [
  PERMISSIONS.CONTENT_READ,
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.TASKS_READ,
  PERMISSIONS.MILESTONES_READ,
  PERMISSIONS.TIMESHEETS_READ,
  PERMISSIONS.CLIENTS_READ,
  PERMISSIONS.LEADS_READ,
  PERMISSIONS.APPLICATIONS_READ,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.ROLES_READ,
  PERMISSIONS.EMPLOYEES_READ,
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.LEAVE_READ,
  PERMISSIONS.MEDIA_READ,
  PERMISSIONS.AUDIT_READ,
];

export function hasInternalSurface(user: AuthUser): boolean {
  return INTERNAL_SURFACE.some((permission) => user.permissions.includes(permission));
}

function can(user: AuthUser, permission: PermissionKey): boolean {
  return user.permissions.includes(permission);
}

function isClientSurface(user: AuthUser): boolean {
  return user.roles.includes(ROLES.CLIENT) && !hasInternalSurface(user);
}

function zonedParts(date: Date): { y: number; m: number; d: number } {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

function startOfZonedDay(date: Date): Date {
  const { y, m, d } = zonedParts(date);
  return new Date(Date.UTC(y, m, d) - TZ_OFFSET_MS);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function resolveDashboardWindow(
  range: DashboardRange,
  now = new Date(),
): { from: Date; to: Date; previousFrom: Date; previousTo: Date } {
  const to = now;
  const today = startOfZonedDay(now);
  const { y, m } = zonedParts(now);

  if (range === '7d') {
    const from = addDays(today, -6);
    return { from, to, previousFrom: addDays(from, -7), previousTo: from };
  }
  if (range === '30d') {
    const from = addDays(today, -29);
    return { from, to, previousFrom: addDays(from, -30), previousTo: from };
  }
  if (range === 'this_month') {
    const from = new Date(Date.UTC(y, m, 1) - TZ_OFFSET_MS);
    const previousFrom = new Date(Date.UTC(y, m - 1, 1) - TZ_OFFSET_MS);
    return { from, to, previousFrom, previousTo: from };
  }
  if (range === 'last_month') {
    const from = new Date(Date.UTC(y, m - 1, 1) - TZ_OFFSET_MS);
    const toMonth = new Date(Date.UTC(y, m, 1) - TZ_OFFSET_MS);
    const previousFrom = new Date(Date.UTC(y, m - 2, 1) - TZ_OFFSET_MS);
    return { from, to: toMonth, previousFrom, previousTo: from };
  }
  const from = new Date(Date.UTC(y, 0, 1) - TZ_OFFSET_MS);
  const previousFrom = new Date(Date.UTC(y - 1, 0, 1) - TZ_OFFSET_MS);
  return { from, to, previousFrom, previousTo: from };
}

export function trendFromCounts(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function kpi(current: number, previous: number): DashboardKpi {
  return { value: current, previous: previous > 0 || current > 0 ? previous : null };
}

function moneyKpi(current: Prisma.Decimal, previous: Prisma.Decimal): DashboardMoneyKpi {
  const currentN = Number(current);
  const previousN = Number(previous);
  return {
    value: current.toFixed(2),
    previous: previousN > 0 || currentN > 0 ? previous.toFixed(2) : null,
  };
}

function dayKey(date: Date): string {
  const { y, m, d } = zonedParts(date);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fillSeries(from: Date, to: Date, counts: Map<string, number>): DashboardSeriesPoint[] {
  const points: DashboardSeriesPoint[] = [];
  let cursor = startOfZonedDay(from);
  const end = startOfZonedDay(to);
  while (cursor.getTime() <= end.getTime()) {
    const key = dayKey(cursor);
    points.push({ date: key, value: counts.get(key) ?? 0 });
    cursor = addDays(cursor, 1);
  }
  return points;
}

function fillMoneySeries(
  from: Date,
  to: Date,
  issued: Map<string, number>,
  paid: Map<string, number>,
): DashboardMoneyPoint[] {
  const points: DashboardMoneyPoint[] = [];
  let cursor = startOfZonedDay(from);
  const end = startOfZonedDay(to);
  while (cursor.getTime() <= end.getTime()) {
    const key = dayKey(cursor);
    points.push({
      date: key,
      issued: issued.get(key) ?? 0,
      paid: paid.get(key) ?? 0,
    });
    cursor = addDays(cursor, 1);
  }
  return points;
}

function emptyOverview(surface: DashboardOverview['surface'], range: DashboardRange, from: Date, to: Date): DashboardOverview {
  return {
    surface,
    range: { key: range, from: from.toISOString(), to: to.toISOString() },
    kpis: {},
    taskStatus: {},
    ticketStatus: {},
    series: { projects: [], leads: [], invoices: [] },
    recent: { projects: [], tasks: [], leads: [], tickets: [], invoices: [] },
    upcoming: [],
    activity: [],
    modules: [],
  };
}

export async function getDashboardOverview(
  user: AuthUser,
  range: DashboardRange,
): Promise<DashboardOverview> {
  const window = resolveDashboardWindow(range);
  if (isClientSurface(user)) {
    return getPortalOverview(user, range, window);
  }
  return getInternalOverview(user, range, window);
}

async function getInternalOverview(
  user: AuthUser,
  range: DashboardRange,
  window: ReturnType<typeof resolveDashboardWindow>,
): Promise<DashboardOverview> {
  const { from, to } = window;
  const overview = emptyOverview('internal', range, from, to);
  const notDeleted = { deletedAt: null } as const;

  const jobs: Array<Promise<void>> = [];

  if (can(user, PERMISSIONS.PROJECTS_READ)) {
    jobs.push(
      (async () => {
        const [total, active, previousTotal, recent, createdDates] =
          await Promise.all([
            prisma.project.count({ where: notDeleted }),
            prisma.project.count({ where: { ...notDeleted, status: 'ACTIVE' } }),
            prisma.project.count({ where: { ...notDeleted, createdAt: { lt: from } } }),
            prisma.project.findMany({
              where: notDeleted,
              orderBy: { updatedAt: 'desc' },
              take: 6,
              select: {
                id: true,
                name: true,
                status: true,
                dueDate: true,
                updatedAt: true,
                manager: { select: { name: true } },
                client: { select: { companyName: true } },
                tasks: { where: notDeleted, select: { status: true } },
              },
            }),
            prisma.project.findMany({
              where: { ...notDeleted, createdAt: { gte: from, lte: to } },
              select: { createdAt: true },
            }),
          ]);
        overview.kpis.projects = kpi(total, previousTotal);
        overview.kpis.activeProjects = { value: active, previous: null };
        overview.recent.projects = recent.map(toRecentProject);
        overview.series.projects = fillSeries(
          from,
          to,
          bucketDates(createdDates.map((row) => row.createdAt)),
        );
        overview.modules.push({ key: 'projects', count: total });
      })(),
    );
  }

  if (can(user, PERMISSIONS.TASKS_READ)) {
    jobs.push(
      (async () => {
        const privileged = user.roles.some(
          (role) => role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN || role === ROLES.MANAGER,
        );
        const staffOnly = user.roles.includes(ROLES.STAFF) && !privileged;
        const assigned = staffOnly ? { assigneeId: user.id } : {};
        const [open, previousOpen, grouped, recent] = await Promise.all([
          prisma.task.count({ where: { ...notDeleted, ...assigned, status: { in: OPEN_TASK } } }),
          prisma.task.count({
            where: {
              ...notDeleted,
              ...assigned,
              status: { in: OPEN_TASK },
              createdAt: { lt: from },
            },
          }),
          prisma.task.groupBy({
            by: ['status'],
            where: { ...notDeleted, ...assigned },
            _count: { _all: true },
          }),
          prisma.task.findMany({
            where: { ...notDeleted, ...assigned },
            orderBy: { updatedAt: 'desc' },
            take: 6,
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              project: { select: { name: true } },
              assignee: { select: { name: true } },
            },
          }),
        ]);
        overview.kpis.openTasks = kpi(open, previousOpen);
        overview.taskStatus = Object.fromEntries(
          grouped.map((row) => [row.status, row._count._all]),
        ) as DashboardOverview['taskStatus'];
        overview.recent.tasks = recent.map(
          (row): DashboardRecentTask => ({
            id: row.id,
            title: row.title,
            status: row.status,
            priority: row.priority,
            dueDate: row.dueDate?.toISOString() ?? null,
            projectName: row.project.name,
            assigneeName: row.assignee?.name ?? null,
          }),
        );
        overview.modules.push({ key: 'tasks', count: open });
      })(),
    );
  }

  if (can(user, PERMISSIONS.LEADS_READ)) {
    jobs.push(
      (async () => {
        const [total, fresh, recent, createdDates] = await Promise.all([
          prisma.inquiry.count(),
          prisma.inquiry.count({ where: { status: 'NEW' } }),
          prisma.inquiry.findMany({
            orderBy: { createdAt: 'desc' },
            take: 6,
            select: { id: true, name: true, email: true, status: true, createdAt: true },
          }),
          prisma.inquiry.findMany({
            where: { createdAt: { gte: from, lte: to } },
            select: { createdAt: true },
          }),
        ]);
        overview.kpis.openLeads = { value: fresh, previous: null };
        overview.recent.leads = recent.map(
          (row): DashboardRecentLead => ({
            id: row.id,
            name: row.name,
            email: row.email,
            status: row.status,
            createdAt: row.createdAt.toISOString(),
          }),
        );
        overview.series.leads = fillSeries(
          from,
          to,
          bucketDates(createdDates.map((row) => row.createdAt)),
        );
        overview.modules.push({ key: 'leads', count: total });
      })(),
    );
  }

  if (can(user, PERMISSIONS.CLIENTS_READ)) {
    jobs.push(
      (async () => {
        const [active, total] = await Promise.all([
          prisma.client.count({ where: { ...notDeleted, status: 'ACTIVE' } }),
          prisma.client.count({ where: notDeleted }),
        ]);
        overview.kpis.activeClients = { value: active, previous: null };
        overview.modules.push({ key: 'clients', count: total });
      })(),
    );
  }

  if (can(user, PERMISSIONS.TICKETS_READ)) {
    jobs.push(
      (async () => {
        const [open, grouped, recent] = await Promise.all([
          prisma.supportTicket.count({
            where: { ...notDeleted, status: { in: OPEN_TICKET } },
          }),
          prisma.supportTicket.groupBy({
            by: ['status'],
            where: notDeleted,
            _count: { _all: true },
          }),
          prisma.supportTicket.findMany({
            where: notDeleted,
            orderBy: { updatedAt: 'desc' },
            take: 6,
            select: {
              id: true,
              code: true,
              subject: true,
              status: true,
              priority: true,
              createdAt: true,
              client: { select: { companyName: true } },
              assignee: { select: { name: true } },
            },
          }),
        ]);
        overview.kpis.openTickets = { value: open, previous: null };
        overview.ticketStatus = Object.fromEntries(
          grouped.map((row) => [row.status, row._count._all]),
        ) as DashboardOverview['ticketStatus'];
        overview.recent.tickets = recent.map(toRecentTicket);
        overview.modules.push({ key: 'tickets', count: open });
      })(),
    );
  }

  if (can(user, PERMISSIONS.INVOICES_READ)) {
    jobs.push(
      (async () => {
        await prisma.invoice.updateMany({
          where: { deletedAt: null, status: 'SENT', dueDate: { lt: new Date() } },
          data: { status: 'OVERDUE' },
        });
        const [pending, overdue, revenue, previousRevenue, recent, seriesRows] = await Promise.all([
          prisma.invoice.count({ where: { ...notDeleted, status: { in: [...OPEN_INVOICE] } } }),
          prisma.invoice.count({ where: { ...notDeleted, status: 'OVERDUE' } }),
          prisma.invoice.aggregate({
            where: { ...notDeleted, status: { not: 'VOID' } },
            _sum: { paidAmount: true },
          }),
          prisma.invoice.aggregate({
            where: { ...notDeleted, status: { not: 'VOID' }, createdAt: { lt: from } },
            _sum: { paidAmount: true },
          }),
          prisma.invoice.findMany({
            where: notDeleted,
            orderBy: { createdAt: 'desc' },
            take: 6,
            select: {
              id: true,
              number: true,
              status: true,
              total: true,
              dueDate: true,
              client: { select: { companyName: true } },
            },
          }),
          prisma.invoice.findMany({
            where: { ...notDeleted, createdAt: { gte: from, lte: to } },
            select: { createdAt: true, total: true, paidAmount: true },
          }),
        ]);
        overview.kpis.pendingInvoices = { value: pending, previous: null };
        overview.kpis.revenue = moneyKpi(
          revenue._sum.paidAmount ?? new Prisma.Decimal(0),
          previousRevenue._sum.paidAmount ?? new Prisma.Decimal(0),
        );
        overview.recent.invoices = recent.map(
          (row): DashboardRecentInvoice => ({
            id: row.id,
            number: row.number,
            status: row.status,
            total: row.total.toFixed(2),
            dueDate: row.dueDate.toISOString(),
            clientName: row.client.companyName,
          }),
        );
        const issued = new Map<string, number>();
        const paid = new Map<string, number>();
        for (const row of seriesRows) {
          const key = dayKey(row.createdAt);
          issued.set(key, (issued.get(key) ?? 0) + Number(row.total));
          paid.set(key, (paid.get(key) ?? 0) + Number(row.paidAmount));
        }
        overview.series.invoices = fillMoneySeries(from, to, issued, paid);
        overview.modules.push({ key: 'invoices', count: pending });
        void overdue;
      })(),
    );
  }

  if (can(user, PERMISSIONS.EMPLOYEES_READ)) {
    jobs.push(
      (async () => {
        const total = await prisma.employee.count({ where: notDeleted });
        overview.kpis.employees = { value: total, previous: null };
        overview.modules.push({ key: 'employees', count: total });
      })(),
    );
  }

  if (can(user, PERMISSIONS.DOCUMENTS_READ)) {
    jobs.push(
      (async () => {
        const total = await prisma.clientDocument.count({ where: notDeleted });
        overview.kpis.documents = { value: total, previous: null };
        overview.modules.push({ key: 'documents', count: total });
      })(),
    );
  }

  if (can(user, PERMISSIONS.MILESTONES_READ)) {
    jobs.push(
      (async () => {
        const open = await prisma.milestone.count({
          where: { ...notDeleted, status: { not: 'COMPLETED' } },
        });
        overview.kpis.milestones = { value: open, previous: null };
        overview.modules.push({ key: 'milestones', count: open });
      })(),
    );
  }

  for (const [permission, key] of [
    [PERMISSIONS.TIMESHEETS_READ, 'timesheets'],
    [PERMISSIONS.ATTENDANCE_READ, 'attendance'],
    [PERMISSIONS.LEAVE_READ, 'leave'],
    [PERMISSIONS.APPLICATIONS_READ, 'applications'],
    [PERMISSIONS.MEDIA_READ, 'media'],
    [PERMISSIONS.AUDIT_READ, 'audit'],
    [PERMISSIONS.USERS_READ, 'users'],
    [PERMISSIONS.ROLES_READ, 'roles'],
    [PERMISSIONS.CONTENT_READ, 'content'],
  ] as const) {
    if (can(user, permission) && !overview.modules.some((item) => item.key === key)) {
      overview.modules.push({ key, count: null });
    }
  }

  jobs.push(
    (async () => {
      overview.upcoming = await listUpcoming(user, null);
      overview.activity = await listActivity(user, null);
    })(),
  );

  await Promise.all(jobs);
  return overview;
}

async function getPortalOverview(
  user: AuthUser,
  range: DashboardRange,
  window: ReturnType<typeof resolveDashboardWindow>,
): Promise<DashboardOverview> {
  const { from, to } = window;
  const overview = emptyOverview('portal', range, from, to);
  const clientId = user.clientId;
  if (!clientId) return overview;
  const scope = { deletedAt: null, clientId } as const;

  if (can(user, PERMISSIONS.PORTAL_READ)) {
    const [projects, active, recent, milestones] = await Promise.all([
      prisma.project.count({ where: scope }),
      prisma.project.count({ where: { ...scope, status: 'ACTIVE' } }),
      prisma.project.findMany({
        where: scope,
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          status: true,
          dueDate: true,
          updatedAt: true,
          manager: { select: { name: true } },
          client: { select: { companyName: true } },
          tasks: { where: { deletedAt: null }, select: { status: true } },
        },
      }),
      prisma.milestone.count({
        where: { deletedAt: null, status: { not: 'COMPLETED' }, project: { clientId, deletedAt: null } },
      }),
    ]);
    overview.kpis.projects = { value: projects, previous: null };
    overview.kpis.activeProjects = { value: active, previous: null };
    overview.kpis.milestones = { value: milestones, previous: null };
    overview.recent.projects = recent.map(toRecentProject);
    overview.modules.push({ key: 'portal-projects', count: projects });
    overview.modules.push({ key: 'portal-milestones', count: milestones });
  }

  if (can(user, PERMISSIONS.TICKETS_READ)) {
    const [open, grouped, recent] = await Promise.all([
      prisma.supportTicket.count({ where: { ...scope, status: { in: OPEN_TICKET } } }),
      prisma.supportTicket.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
      }),
      prisma.supportTicket.findMany({
        where: scope,
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          code: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          client: { select: { companyName: true } },
          assignee: { select: { name: true } },
        },
      }),
    ]);
    overview.kpis.openTickets = { value: open, previous: null };
    overview.ticketStatus = Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all]),
    ) as DashboardOverview['ticketStatus'];
    overview.recent.tickets = recent.map(toRecentTicket);
    overview.modules.push({ key: 'tickets', count: open });
  }

  if (can(user, PERMISSIONS.INVOICES_READ)) {
    await prisma.invoice.updateMany({
      where: { deletedAt: null, clientId, status: 'SENT', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });
    const [pending, revenue, recent] = await Promise.all([
      prisma.invoice.count({ where: { ...scope, status: { in: [...OPEN_INVOICE] } } }),
      prisma.invoice.aggregate({
        where: { ...scope, status: { not: 'VOID' } },
        _sum: { paidAmount: true },
      }),
      prisma.invoice.findMany({
        where: scope,
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          dueDate: true,
          client: { select: { companyName: true } },
        },
      }),
    ]);
    overview.kpis.pendingInvoices = { value: pending, previous: null };
    overview.kpis.revenue = {
      value: (revenue._sum.paidAmount ?? new Prisma.Decimal(0)).toFixed(2),
      previous: null,
    };
    overview.recent.invoices = recent.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      total: row.total.toFixed(2),
      dueDate: row.dueDate.toISOString(),
      clientName: row.client.companyName,
    }));
    overview.modules.push({ key: 'invoices', count: pending });
  }

  if (can(user, PERMISSIONS.DOCUMENTS_READ)) {
    const total = await prisma.clientDocument.count({ where: scope });
    overview.kpis.documents = { value: total, previous: null };
    overview.modules.push({ key: 'documents', count: total });
  }

  overview.upcoming = await listUpcoming(user, clientId);
  overview.activity = [];
  return overview;
}

function bucketDates(dates: Date[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const date of dates) {
    const key = dayKey(date);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function toRecentProject(row: {
  id: string;
  name: string;
  status: DashboardRecentProject['status'];
  dueDate: Date | null;
  updatedAt: Date;
  manager: { name: string } | null;
  client: { companyName: string } | null;
  tasks: { status: TaskStatus }[];
}): DashboardRecentProject {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    dueDate: row.dueDate?.toISOString() ?? null,
    clientName: row.client?.companyName ?? null,
    managerName: row.manager?.name ?? null,
    taskTotal: row.tasks.length,
    taskDone: row.tasks.filter((task) => task.status === 'DONE').length,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRecentTicket(row: {
  id: string;
  code: string;
  subject: string;
  status: TicketStatus;
  priority: string;
  createdAt: Date;
  client: { companyName: string };
  assignee: { name: string } | null;
}): DashboardRecentTicket {
  return {
    id: row.id,
    code: row.code,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    clientName: row.client.companyName,
    assigneeName: row.assignee?.name ?? null,
  };
}

async function listUpcoming(user: AuthUser, clientId: string | null): Promise<DashboardUpcomingItem[]> {
  const horizon = addDays(new Date(), 45);
  const items: DashboardUpcomingItem[] = [];

  if (can(user, PERMISSIONS.PROJECTS_READ) || (clientId && can(user, PERMISSIONS.PORTAL_READ))) {
    const rows = await prisma.project.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: new Date(), lte: horizon },
        status: { in: ['PLANNING', 'ACTIVE', 'ON_HOLD'] },
        ...(clientId ? { clientId } : {}),
      },
      select: { id: true, name: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
      take: 8,
    });
    for (const row of rows) {
      if (!row.dueDate) continue;
      items.push({
        id: `project:${row.id}`,
        kind: 'project',
        title: row.name,
        dueDate: row.dueDate.toISOString(),
        href: clientId ? '/portal/projects' : '/projects',
        meta: 'Project deadline',
      });
    }
  }

  if (can(user, PERMISSIONS.MILESTONES_READ) || (clientId && can(user, PERMISSIONS.PORTAL_READ))) {
    const rows = await prisma.milestone.findMany({
      where: {
        deletedAt: null,
        status: { not: 'COMPLETED' },
        dueDate: { gte: new Date(), lte: horizon },
        ...(clientId ? { project: { clientId, deletedAt: null } } : {}),
      },
      select: { id: true, title: true, dueDate: true, project: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 8,
    });
    for (const row of rows) {
      if (!row.dueDate) continue;
      items.push({
        id: `milestone:${row.id}`,
        kind: 'milestone',
        title: row.title,
        dueDate: row.dueDate.toISOString(),
        href: clientId ? '/portal/milestones' : '/milestones',
        meta: row.project.name,
      });
    }
  }

  if (can(user, PERMISSIONS.TASKS_READ) && !clientId) {
    const rows = await prisma.task.findMany({
      where: {
        deletedAt: null,
        status: { in: OPEN_TASK },
        dueDate: { gte: new Date(), lte: horizon },
      },
      select: { id: true, title: true, dueDate: true, project: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 8,
    });
    for (const row of rows) {
      if (!row.dueDate) continue;
      items.push({
        id: `task:${row.id}`,
        kind: 'task',
        title: row.title,
        dueDate: row.dueDate.toISOString(),
        href: '/tasks',
        meta: row.project.name,
      });
    }
  }

  if (can(user, PERMISSIONS.LEAVE_READ) && !clientId) {
    const rows = await prisma.leaveRequest.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { gte: startOfZonedDay(new Date()), lte: horizon },
      },
      select: {
        id: true,
        type: true,
        startDate: true,
        employee: { select: { user: { select: { name: true } } } },
      },
      orderBy: { startDate: 'asc' },
      take: 6,
    });
    for (const row of rows) {
      items.push({
        id: `leave:${row.id}`,
        kind: 'leave',
        title: `${row.employee.user.name} — ${row.type}`,
        dueDate: row.startDate.toISOString(),
        href: '/leave',
        meta: 'Leave',
      });
    }
  }

  return items
    .sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate))
    .slice(0, 10);
}

async function listActivity(user: AuthUser, clientId: string | null): Promise<DashboardActivityItem[]> {
  if (clientId) return [];
  if (!can(user, PERMISSIONS.AUDIT_READ)) return [];
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: {
      id: true,
      action: true,
      subjectType: true,
      subjectId: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    createdAt: row.createdAt.toISOString(),
  }));
}
