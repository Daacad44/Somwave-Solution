import { Prisma } from '@prisma/client';
import { PERMISSIONS, holdsPermission, type AuthUser, type PermissionKey } from '@somwave/shared';
import { AppError } from '../lib/http';
import { prisma } from '../lib/prisma';
import { projectScope } from './project.service';
import { financeDashboard, trialBalance } from './finance.service';

export type ReportKey =
  | 'projects'
  | 'tasks'
  | 'engineers'
  | 'clients'
  | 'inquiries'
  | 'project-inquiries'
  | 'bugs'
  | 'portfolio'
  | 'articles'
  | 'audit'
  | 'trial-balance'
  | 'my-projects'
  | 'my-invoices';
export type ReportFilter = 'status' | 'projectId' | 'clientId' | 'engineerId' | 'search';
export type ReportQuery = {
  from: Date;
  to: Date;
  page: number;
  pageSize: number;
  status?: string;
  projectId?: string;
  clientId?: string;
  engineerId?: string;
  search?: string;
};
type Column = { key: string; label: string };
type ReportRow = Record<string, string | number | null>;

export const REPORT_STATUS_OPTIONS: Partial<Record<ReportKey, readonly string[]>> = {
  projects: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
  tasks: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'TESTING', 'DONE', 'CANCELLED'],
  clients: ['ACTIVE', 'INACTIVE'],
  inquiries: ['NEW', 'READ', 'ARCHIVED'],
  'project-inquiries': [
    'PENDING_VERIFICATION',
    'EMAIL_VERIFIED',
    'ACCOUNT_CREATED',
    'UNDER_REVIEW',
    'PROPOSAL_SENT',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'CONVERTED',
  ],
  bugs: [
    'REPORTED',
    'TRIAGED',
    'ASSIGNED',
    'IN_PROGRESS',
    'CODE_REVIEW',
    'TESTING',
    'RESOLVED',
    'CLOSED',
    'REOPENED',
  ],
  portfolio: ['PUBLISHED', 'DRAFT'],
  articles: ['PUBLISHED', 'DRAFT'],
  'my-projects': ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
  'my-invoices': ['SENT', 'PARTIAL', 'PAID', 'OVERDUE'],
};

const definitions: Record<
  ReportKey,
  {
    label: string;
    category: string;
    description: string;
    permission: PermissionKey;
    filters: ReportFilter[];
    columns: Column[];
  }
> = {
  projects: {
    label: 'Projects',
    category: 'Projects',
    description: 'Projects created in the selected period; delayed means past due and unfinished.',
    permission: PERMISSIONS.PROJECTS_READ,
    filters: ['status', 'projectId', 'clientId', 'engineerId', 'search'],
    columns: [
      { key: 'name', label: 'Project' },
      { key: 'status', label: 'Status' },
      { key: 'client', label: 'Client' },
      { key: 'manager', label: 'Manager' },
      { key: 'dueDate', label: 'Due date' },
      { key: 'taskCompletion', label: 'Task completion' },
      { key: 'href', label: 'Link' },
    ],
  },
  tasks: {
    label: 'Tasks',
    category: 'Projects',
    description: 'Non-deleted tasks created in the selected period.',
    permission: PERMISSIONS.TASKS_READ,
    filters: ['status', 'projectId', 'clientId', 'engineerId', 'search'],
    columns: [
      { key: 'title', label: 'Task' },
      { key: 'project', label: 'Project' },
      { key: 'status', label: 'Status' },
      { key: 'assignee', label: 'Assignee' },
      { key: 'dueDate', label: 'Due date' },
      { key: 'completedAt', label: 'Completed' },
      { key: 'href', label: 'Link' },
    ],
  },
  engineers: {
    label: 'Engineer assignments',
    category: 'Engineering',
    description: 'Current project assignments and task workload, without private employee data.',
    permission: PERMISSIONS.ENGINEERING_MANAGE,
    filters: ['projectId', 'engineerId', 'search'],
    columns: [
      { key: 'engineer', label: 'Engineer' },
      { key: 'project', label: 'Project' },
      { key: 'role', label: 'Role' },
      { key: 'assignedAt', label: 'Assigned' },
      { key: 'openTasks', label: 'Open tasks' },
      { key: 'completedTasks', label: 'Completed tasks' },
      { key: 'href', label: 'Link' },
    ],
  },
  clients: {
    label: 'Clients',
    category: 'Clients',
    description: 'Non-deleted client records created in the selected period.',
    permission: PERMISSIONS.CLIENTS_READ,
    filters: ['status', 'clientId', 'search'],
    columns: [
      { key: 'companyName', label: 'Client' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Registered' },
      { key: 'projectCount', label: 'Projects' },
      { key: 'href', label: 'Link' },
    ],
  },
  inquiries: {
    label: 'Inquiries',
    category: 'Clients',
    description: 'Website inquiries created in the selected period; contact details are omitted.',
    permission: PERMISSIONS.LEADS_READ,
    filters: ['status', 'search'],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Submitted' },
      { key: 'converted', label: 'Converted' },
      { key: 'href', label: 'Link' },
    ],
  },
  'project-inquiries': {
    label: 'Project requests',
    category: 'Clients',
    description:
      'Public project requests submitted in the period, including verification and conversion state. Contact details are omitted.',
    permission: PERMISSIONS.LEADS_READ,
    filters: ['status', 'projectId', 'clientId', 'search'],
    columns: [
      { key: 'name', label: 'Requester' },
      { key: 'companyName', label: 'Company' },
      { key: 'projectType', label: 'Project type' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Submitted' },
      { key: 'href', label: 'Link' },
    ],
  },
  bugs: {
    label: 'Bug reports',
    category: 'Operations',
    description: 'Project-scoped bugs reported in the selected period.',
    permission: PERMISSIONS.ENGINEERING_READ,
    filters: ['status', 'projectId', 'engineerId', 'search'],
    columns: [
      { key: 'title', label: 'Bug' },
      { key: 'project', label: 'Project' },
      { key: 'severity', label: 'Severity' },
      { key: 'status', label: 'Status' },
      { key: 'reportedAt', label: 'Reported' },
      { key: 'resolvedAt', label: 'Resolved' },
      { key: 'href', label: 'Link' },
    ],
  },
  portfolio: {
    label: 'Portfolio',
    category: 'Website',
    description:
      'CMS portfolio records created in the selected period. Demo clicks are recorded lifetime totals; view counts are unavailable.',
    permission: PERMISSIONS.CONTENT_READ,
    filters: ['status', 'search'],
    columns: [
      { key: 'title', label: 'Project' },
      { key: 'category', label: 'Category' },
      { key: 'published', label: 'Published' },
      { key: 'demoClicks', label: 'Demo clicks (lifetime)' },
      { key: 'createdAt', label: 'Created' },
      { key: 'href', label: 'Link' },
    ],
  },
  articles: {
    label: 'Articles',
    category: 'Website',
    description: 'CMS articles created in the selected period; view counts are unavailable.',
    permission: PERMISSIONS.CONTENT_READ,
    filters: ['status', 'search'],
    columns: [
      { key: 'title', label: 'Article' },
      { key: 'published', label: 'Published' },
      { key: 'publishedAt', label: 'Published at' },
      { key: 'createdAt', label: 'Created' },
      { key: 'href', label: 'Link' },
    ],
  },
  audit: {
    label: 'Audit activity',
    category: 'Security',
    description: 'Recorded audit metadata only; secrets and before/after payloads are excluded.',
    permission: PERMISSIONS.AUDIT_READ,
    filters: ['search'],
    columns: [
      { key: 'action', label: 'Action' },
      { key: 'subjectType', label: 'Subject' },
      { key: 'actorId', label: 'Actor ID' },
      { key: 'createdAt', label: 'When' },
    ],
  },
  'trial-balance': {
    label: 'Trial balance',
    category: 'Finance',
    description: 'Posted, finalized journal lines grouped by account and currency.',
    permission: PERMISSIONS.FINANCE_READ,
    filters: [],
    columns: [
      { key: 'code', label: 'Account code' },
      { key: 'name', label: 'Account' },
      { key: 'type', label: 'Type' },
      { key: 'currency', label: 'Currency' },
      { key: 'debit', label: 'Debit' },
      { key: 'credit', label: 'Credit' },
      { key: 'balance', label: 'Net debit' },
    ],
  },
  'my-projects': {
    label: 'My projects',
    category: 'Client',
    description: 'Projects belonging to your client account and created in the selected period.',
    permission: PERMISSIONS.PORTAL_READ,
    filters: ['status', 'projectId', 'search'],
    columns: [
      { key: 'name', label: 'Project' },
      { key: 'status', label: 'Status' },
      { key: 'manager', label: 'Manager' },
      { key: 'dueDate', label: 'Due date' },
      { key: 'href', label: 'Link' },
    ],
  },
  'my-invoices': {
    label: 'My invoices',
    category: 'Client',
    description:
      'Issued invoices belonging to your client account. Invoice currency is not stored in the legacy invoice record.',
    permission: PERMISSIONS.INVOICES_READ,
    filters: ['status', 'projectId'],
    columns: [
      { key: 'number', label: 'Invoice' },
      { key: 'status', label: 'Status' },
      { key: 'issueDate', label: 'Issued' },
      { key: 'dueDate', label: 'Due' },
      { key: 'total', label: 'Total' },
      { key: 'paidAmount', label: 'Paid' },
      { key: 'outstanding', label: 'Outstanding' },
      { key: 'href', label: 'Link' },
    ],
  },
};

function can(user: AuthUser, permission: PermissionKey): boolean {
  return holdsPermission(user, permission);
}
function financeProof(user: AuthUser, mfaVerifiedAt?: number | null): void {
  if (!user.twoFactorEnabled || !mfaVerifiedAt)
    throw new AppError(
      'FORBIDDEN',
      403,
      'Enable and verify two-factor authentication to view finance reports',
    );
}
function authorized(user: AuthUser, key: string, mfaVerifiedAt?: number | null): ReportKey {
  if (!(key in definitions)) throw new AppError('NOT_FOUND', 404, 'Unknown report');
  const reportKey = key as ReportKey;
  if (!can(user, definitions[reportKey].permission))
    throw new AppError('FORBIDDEN', 403, 'Insufficient permissions');
  if ((reportKey === 'my-projects' || reportKey === 'my-invoices') && !user.clientId)
    throw new AppError('FORBIDDEN', 403, 'Client account required');
  if (reportKey === 'trial-balance') financeProof(user, mfaVerifiedAt);
  return reportKey;
}
function period(query: ReportQuery) {
  return {
    from: query.from.toISOString(),
    to: query.to.toISOString(),
    timezone: 'Africa/Mogadishu',
    endExclusive: true,
  };
}
function page(query: ReportQuery) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}
function iso(date: Date | null | undefined): string | null {
  return date?.toISOString() ?? null;
}
function search(value?: string): { contains: string; mode: 'insensitive' } | undefined {
  return value ? { contains: value, mode: 'insensitive' } : undefined;
}
function projectWhere(user: AuthUser, query: ReportQuery): Prisma.ProjectWhereInput {
  return {
    deletedAt: null,
    ...projectScope(user),
    createdAt: { gte: query.from, lt: query.to },
    ...(query.status && { status: query.status as Prisma.EnumProjectStatusFilter['equals'] }),
    ...(query.projectId && { id: query.projectId }),
    ...(query.clientId && { clientId: query.clientId }),
    ...(query.engineerId && { members: { some: { userId: query.engineerId, removedAt: null } } }),
    ...(query.search && { name: search(query.search) }),
  };
}
function accessibleProject(user: AuthUser): Prisma.ProjectWhereInput {
  return { deletedAt: null, ...projectScope(user) };
}

export function listReportCatalog(user: AuthUser, mfaVerifiedAt?: number | null) {
  return {
    reports: Object.entries(definitions)
      .filter(
        ([key, item]) =>
          can(user, item.permission) &&
          (key !== 'trial-balance' || (user.twoFactorEnabled && !!mfaVerifiedAt)) &&
          ((key !== 'my-projects' && key !== 'my-invoices') || !!user.clientId),
      )
      .map(([key, item]) => ({
        key,
        ...item,
        statusOptions: REPORT_STATUS_OPTIONS[key as ReportKey] ?? [],
      })),
  };
}

export async function getReportOverview(
  user: AuthUser,
  query: ReportQuery,
  mfaVerifiedAt?: number | null,
) {
  const metrics: Record<
    string,
    number | string | Record<string, unknown> | Array<Record<string, unknown>>
  > = {};
  const project = accessibleProject(user);
  const created = { gte: query.from, lt: query.to };
  if (can(user, PERMISSIONS.PROJECTS_READ)) {
    const [total, active, completed, delayed] = await Promise.all([
      prisma.project.count({ where: { ...project, createdAt: created } }),
      prisma.project.count({ where: { ...project, status: 'ACTIVE' } }),
      prisma.project.count({ where: { ...project, status: 'COMPLETED' } }),
      prisma.project.count({
        where: {
          ...project,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          dueDate: { lt: new Date() },
        },
      }),
    ]);
    Object.assign(metrics, {
      newProjects: total,
      activeProjects: active,
      completedProjects: completed,
      delayedProjects: delayed,
    });
  }
  if (can(user, PERMISSIONS.TASKS_READ)) {
    const task = { deletedAt: null, project };
    const [total, done] = await Promise.all([
      prisma.task.count({ where: { ...task, createdAt: created } }),
      prisma.task.count({ where: { ...task, status: 'DONE', completedAt: created } }),
    ]);
    Object.assign(metrics, { newTasks: total, completedTasks: done });
  }
  if (can(user, PERMISSIONS.CLIENTS_READ))
    metrics.newClients = await prisma.client.count({
      where: { deletedAt: null, createdAt: created },
    });
  if (can(user, PERMISSIONS.LEADS_READ)) {
    const [newInquiries, newProjectRequests, convertedProjectRequests] = await Promise.all([
      prisma.inquiry.count({ where: { createdAt: created } }),
      prisma.projectInquiry.count({ where: { createdAt: created } }),
      prisma.projectInquiry.count({ where: { createdAt: created, status: 'CONVERTED' } }),
    ]);
    Object.assign(metrics, { newInquiries, newProjectRequests, convertedProjectRequests });
  }
  if (can(user, PERMISSIONS.ENGINEERING_READ))
    metrics.openBugs = await prisma.bugReport.count({
      where: { project, status: { notIn: ['CLOSED', 'RESOLVED'] } },
    });
  if (can(user, PERMISSIONS.CONTENT_READ)) {
    const [portfolio, articles] = await Promise.all([
      prisma.portfolioItem.count({ where: { isPublished: true } }),
      prisma.post.count({ where: { isPublished: true } }),
    ]);
    Object.assign(metrics, { publishedPortfolio: portfolio, publishedArticles: articles });
  }
  if (can(user, PERMISSIONS.FINANCE_READ) && user.twoFactorEnabled && mfaVerifiedAt)
    metrics.finance = (await financeDashboard(query.from, query.to)).currencies;
  if (user.clientId && can(user, PERMISSIONS.PORTAL_READ))
    metrics.myActiveProjects = await prisma.project.count({
      where: { deletedAt: null, clientId: user.clientId, status: 'ACTIVE' },
    });
  if (user.clientId && can(user, PERMISSIONS.INVOICES_READ))
    metrics.myOutstandingInvoices = await prisma.invoice.count({
      where: {
        deletedAt: null,
        clientId: user.clientId,
        status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
      },
    });
  return { period: period(query), generatedAt: new Date().toISOString(), metrics };
}

export async function getReport(
  user: AuthUser,
  key: string,
  query: ReportQuery,
  mfaVerifiedAt?: number | null,
) {
  const reportKey = authorized(user, key, mfaVerifiedAt);
  const metadata = definitions[reportKey];
  let rows: ReportRow[] = [];
  let total = 0;
  const paging = page(query);
  const date = { gte: query.from, lt: query.to };
  const project = accessibleProject(user);
  switch (reportKey) {
    case 'projects': {
      const where = projectWhere(user, query);
      const [count, items] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            dueDate: true,
            client: { select: { companyName: true } },
            manager: { select: { name: true } },
          },
        }),
      ]);
      total = count;
      const taskCounts = items.length
        ? await prisma.task.groupBy({
            by: ['projectId', 'status'],
            where: { projectId: { in: items.map((item) => item.id) }, deletedAt: null },
            _count: { _all: true },
          })
        : [];
      rows = items.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        client: item.client?.companyName ?? null,
        manager: item.manager?.name ?? null,
        dueDate: iso(item.dueDate),
        taskCompletion: (() => {
          const counts = taskCounts.filter((row) => row.projectId === item.id);
          const all = counts.reduce((sum, row) => sum + row._count._all, 0);
          return all
            ? Math.round(
                ((counts.find((row) => row.status === 'DONE')?._count._all ?? 0) / all) * 100,
              )
            : null;
        })(),
        href: `/projects/${item.id}`,
      }));
      break;
    }
    case 'tasks': {
      const where: Prisma.TaskWhereInput = {
        deletedAt: null,
        project: { ...project, ...(query.clientId && { clientId: query.clientId }) },
        createdAt: date,
        ...(query.projectId && { projectId: query.projectId }),
        ...(query.engineerId && { assigneeId: query.engineerId }),
        ...(query.status && { status: query.status as Prisma.EnumTaskStatusFilter['equals'] }),
        ...(query.search && { title: search(query.search) }),
      };
      const [count, items] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            completedAt: true,
            assignee: { select: { name: true } },
            project: { select: { id: true, name: true } },
          },
        }),
      ]);
      total = count;
      rows = items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        project: item.project.name,
        assignee: item.assignee?.name ?? null,
        dueDate: iso(item.dueDate),
        completedAt: iso(item.completedAt),
        href: `/projects/${item.project.id}`,
      }));
      break;
    }
    case 'engineers': {
      const where: Prisma.ProjectMemberWhereInput = {
        removedAt: null,
        assignedAt: date,
        project: project,
        ...(query.projectId && { projectId: query.projectId }),
        ...(query.engineerId && { userId: query.engineerId }),
        ...(query.search && { user: { name: search(query.search) } }),
      };
      const [count, items] = await Promise.all([
        prisma.projectMember.count({ where }),
        prisma.projectMember.findMany({
          where,
          ...paging,
          orderBy: { assignedAt: 'desc' },
          select: {
            userId: true,
            role: true,
            assignedAt: true,
            user: { select: { name: true } },
            project: { select: { id: true, name: true } },
          },
        }),
      ]);
      total = count;
      const counts = await Promise.all(
        items.map((item) =>
          prisma.task.groupBy({
            by: ['status'],
            where: { projectId: item.project.id, assigneeId: item.userId, deletedAt: null },
            _count: { _all: true },
          }),
        ),
      );
      rows = items.map((item, index) => ({
        engineerId: item.userId,
        engineer: item.user.name,
        project: item.project.name,
        role: item.role,
        assignedAt: iso(item.assignedAt),
        openTasks: (counts[index] ?? [])
          .filter((group) => !['DONE', 'CANCELLED'].includes(group.status))
          .reduce((sum, group) => sum + group._count._all, 0),
        completedTasks:
          (counts[index] ?? []).find((group) => group.status === 'DONE')?._count._all ?? 0,
        href: `/projects/${item.project.id}`,
      }));
      break;
    }
    case 'clients': {
      const where: Prisma.ClientWhereInput = {
        deletedAt: null,
        createdAt: date,
        ...(query.clientId && { id: query.clientId }),
        ...(query.status && { status: query.status as Prisma.EnumClientStatusFilter['equals'] }),
        ...(query.search && { companyName: search(query.search) }),
      };
      const [count, items] = await Promise.all([
        prisma.client.count({ where }),
        prisma.client.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            companyName: true,
            status: true,
            createdAt: true,
            _count: { select: { projects: { where: { deletedAt: null } } } },
          },
        }),
      ]);
      total = count;
      rows = items.map((item) => ({
        id: item.id,
        companyName: item.companyName,
        status: item.status,
        createdAt: iso(item.createdAt),
        projectCount: item._count.projects,
        href: `/clients/${item.id}`,
      }));
      break;
    }
    case 'inquiries': {
      const where: Prisma.InquiryWhereInput = {
        createdAt: date,
        ...(query.status && { status: query.status as Prisma.EnumInquiryStatusFilter['equals'] }),
        ...(query.search && { name: search(query.search) }),
      };
      const [count, items] = await Promise.all([
        prisma.inquiry.count({ where }),
        prisma.inquiry.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, status: true, createdAt: true, convertedClientId: true },
        }),
      ]);
      total = count;
      rows = items.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        createdAt: iso(item.createdAt),
        converted: item.convertedClientId ? 'Yes' : 'No',
        href: '/leads',
      }));
      break;
    }
    case 'project-inquiries': {
      const where: Prisma.ProjectInquiryWhereInput = {
        createdAt: date,
        ...(query.status && {
          status: query.status as Prisma.EnumProjectInquiryStatusFilter['equals'],
        }),
        ...(query.projectId && { projectId: query.projectId }),
        ...(query.clientId && { clientId: query.clientId }),
        ...(query.search && {
          OR: [{ name: search(query.search) }, { companyName: search(query.search) }],
        }),
      };
      const [count, items] = await Promise.all([
        prisma.projectInquiry.count({ where }),
        prisma.projectInquiry.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            companyName: true,
            projectType: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);
      total = count;
      rows = items.map((item) => ({
        id: item.id,
        name: item.name,
        companyName: item.companyName,
        projectType: item.projectType,
        status: item.status,
        createdAt: iso(item.createdAt),
        href: '/leads',
      }));
      break;
    }
    case 'bugs': {
      const where: Prisma.BugReportWhereInput = {
        project,
        reportedAt: date,
        ...(query.projectId && { projectId: query.projectId }),
        ...(query.engineerId && { assigneeId: query.engineerId }),
        ...(query.status && { status: query.status as Prisma.EnumBugStatusFilter['equals'] }),
        ...(query.search && { title: search(query.search) }),
      };
      const [count, items] = await Promise.all([
        prisma.bugReport.count({ where }),
        prisma.bugReport.findMany({
          where,
          ...paging,
          orderBy: { reportedAt: 'desc' },
          select: {
            id: true,
            title: true,
            severity: true,
            status: true,
            reportedAt: true,
            resolvedAt: true,
            project: { select: { id: true, name: true } },
          },
        }),
      ]);
      total = count;
      rows = items.map((item) => ({
        id: item.id,
        title: item.title,
        project: item.project.name,
        severity: item.severity,
        status: item.status,
        reportedAt: iso(item.reportedAt),
        resolvedAt: iso(item.resolvedAt),
        href: `/projects/${item.project.id}`,
      }));
      break;
    }
    case 'portfolio': {
      const where: Prisma.PortfolioItemWhereInput = {
        createdAt: date,
        ...(query.status && { isPublished: query.status === 'PUBLISHED' }),
        ...(query.search && { title: search(query.search) }),
      };
      const [count, items] = await Promise.all([
        prisma.portfolioItem.count({ where }),
        prisma.portfolioItem.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            slug: true,
            title: true,
            category: true,
            isPublished: true,
            demoClicks: true,
            createdAt: true,
          },
        }),
      ]);
      total = count;
      rows = items.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        published: item.isPublished ? 'Yes' : 'No',
        demoClicks: item.demoClicks,
        createdAt: iso(item.createdAt),
        href: '/cms/portfolio',
      }));
      break;
    }
    case 'articles': {
      const where: Prisma.PostWhereInput = {
        createdAt: date,
        ...(query.status && { isPublished: query.status === 'PUBLISHED' }),
        ...(query.search && { title: search(query.search) }),
      };
      const [count, items] = await Promise.all([
        prisma.post.count({ where }),
        prisma.post.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            slug: true,
            title: true,
            isPublished: true,
            publishedAt: true,
            createdAt: true,
          },
        }),
      ]);
      total = count;
      rows = items.map((item) => ({
        id: item.id,
        title: item.title,
        published: item.isPublished ? 'Yes' : 'No',
        publishedAt: iso(item.publishedAt),
        createdAt: iso(item.createdAt),
        href: '/cms/posts',
      }));
      break;
    }
    case 'audit': {
      const where: Prisma.AuditLogWhereInput = {
        createdAt: date,
        ...(query.search && {
          OR: [{ action: search(query.search) }, { subjectType: search(query.search) }],
        }),
      };
      const [count, items] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: { id: true, action: true, subjectType: true, actorId: true, createdAt: true },
        }),
      ]);
      total = count;
      rows = items.map((item) => ({
        id: item.id,
        action: item.action,
        subjectType: item.subjectType,
        actorId: item.actorId,
        createdAt: iso(item.createdAt),
      }));
      break;
    }
    case 'trial-balance': {
      const all = await trialBalance(query.from, query.to);
      total = all.length;
      rows = all.slice(paging.skip, paging.skip + paging.take);
      break;
    }
    case 'my-projects': {
      const where: Prisma.ProjectWhereInput = {
        deletedAt: null,
        clientId: user.clientId!,
        createdAt: date,
        ...(query.projectId && { id: query.projectId }),
        ...(query.status && { status: query.status as Prisma.EnumProjectStatusFilter['equals'] }),
        ...(query.search && { name: search(query.search) }),
      };
      const [count, items] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            dueDate: true,
            manager: { select: { name: true } },
          },
        }),
      ]);
      total = count;
      rows = items.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        manager: item.manager?.name ?? null,
        dueDate: iso(item.dueDate),
        href: `/portal/projects/${item.id}`,
      }));
      break;
    }
    case 'my-invoices': {
      const where: Prisma.InvoiceWhereInput = {
        deletedAt: null,
        clientId: user.clientId!,
        issueDate: date,
        status: query.status
          ? (query.status as Prisma.EnumInvoiceStatusFilter['equals'])
          : { notIn: ['DRAFT', 'VOID'] },
        ...(query.projectId && { projectId: query.projectId }),
      };
      const [count, items] = await Promise.all([
        prisma.invoice.count({ where }),
        prisma.invoice.findMany({
          where,
          ...paging,
          orderBy: { issueDate: 'desc' },
          select: {
            id: true,
            number: true,
            status: true,
            issueDate: true,
            dueDate: true,
            total: true,
            paidAmount: true,
          },
        }),
      ]);
      total = count;
      rows = items.map((item) => ({
        id: item.id,
        number: item.number,
        status: item.status,
        issueDate: iso(item.issueDate),
        dueDate: iso(item.dueDate),
        total: item.total.toFixed(2),
        paidAmount: item.paidAmount.toFixed(2),
        outstanding: item.total.sub(item.paidAmount).toFixed(2),
        href: `/invoices/${item.id}`,
      }));
      break;
    }
  }
  return {
    key: reportKey,
    columns: metadata.columns,
    rows,
    summary: { total },
    period: period(query),
    generatedAt: new Date().toISOString(),
    meta: { page: query.page, pageSize: query.pageSize, total },
  };
}

export function csvCell(value: string): string {
  const escaped = /^\s*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${escaped.replaceAll('"', '""')}"`;
}
export function reportToCsv(columns: Column[], rows: ReportRow[]): string {
  return (
    [
      columns.map((column) => csvCell(column.label)).join(','),
      ...rows.map((row) =>
        columns.map((column) => csvCell(String(row[column.key] ?? ''))).join(','),
      ),
    ].join('\r\n') + '\r\n'
  );
}
