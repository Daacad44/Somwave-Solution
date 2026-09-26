import { type ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  Folder,
  Headphones,
  Image,
  KeyRound,
  LayoutGrid,
  ListTodo,
  Plus,
  Receipt,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  DASHBOARD_RANGES,
  PERMISSIONS,
  type DashboardOverview,
  type DashboardRange,
  type PermissionKey,
  type TaskStatus,
} from '@somwave/shared';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/states';
import { useCurrentUser } from '../auth/hooks';
import { hasPermission } from '../../lib/rbac';
import { DISPLAY_TIMEZONE, formatLongDate, greetingForNow } from '../../lib/date';
import { cn } from '../../lib/cn';
import { useDashboardOverview } from './hooks';
import { AreaChart, BarChart, DonutChart, InvoiceChart } from './charts';
import {
  PROJECT_STATUS_LABELS_EN,
  TASK_STATUS_LABELS_EN,
  TICKET_STATUS_LABELS_EN,
  activityLabel,
  formatMoney,
  formatRoleName,
  hasMoneySeries,
  kpiTrend,
  moneyTrend,
  projectProgress,
} from './metrics';

type PillTone = 'success' | 'brand' | 'warning' | 'neutral';

const RANGE_LABELS: Record<DashboardRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  this_month: 'This month',
  last_month: 'Last month',
  this_year: 'This year',
};

const TASK_SLICE: Record<TaskStatus, { label: string; className: string }> = {
  TODO: { label: 'To do', className: 'text-muted' },
  IN_PROGRESS: { label: 'In progress', className: 'text-brand' },
  IN_REVIEW: { label: 'In review', className: 'text-warning' },
  DONE: { label: 'Done', className: 'text-success' },
};

const PILL: Record<PillTone, string> = {
  success: 'bg-success-soft text-success',
  brand: 'bg-brand-soft text-brand',
  warning: 'bg-warning-soft text-warning',
  neutral: 'bg-canvas text-muted',
};

const PROJECT_TONE: Record<string, PillTone> = {
  PLANNING: 'brand',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

type ModuleDef = {
  key: string;
  to: string;
  label: string;
  description: string;
  permission: PermissionKey;
  icon: LucideIcon;
};

const MODULES: ModuleDef[] = [
  {
    key: 'projects',
    to: '/projects',
    label: 'Projects',
    description: 'Manage active and completed projects',
    permission: PERMISSIONS.PROJECTS_READ,
    icon: Folder,
  },
  {
    key: 'tasks',
    to: '/tasks',
    label: 'Tasks',
    description: 'Track work across all projects',
    permission: PERMISSIONS.TASKS_READ,
    icon: ListTodo,
  },
  {
    key: 'milestones',
    to: '/milestones',
    label: 'Milestones',
    description: 'Delivery checkpoints',
    permission: PERMISSIONS.MILESTONES_READ,
    icon: CalendarDays,
  },
  {
    key: 'timesheets',
    to: '/timesheets',
    label: 'Timesheets',
    description: 'Recorded hours',
    permission: PERMISSIONS.TIMESHEETS_READ,
    icon: Clock,
  },
  {
    key: 'clients',
    to: '/clients',
    label: 'Clients',
    description: 'Companies you work with',
    permission: PERMISSIONS.CLIENTS_READ,
    icon: Building2,
  },
  {
    key: 'leads',
    to: '/leads',
    label: 'Leads',
    description: 'Website enquiries',
    permission: PERMISSIONS.LEADS_READ,
    icon: Users,
  },
  {
    key: 'tickets',
    to: '/tickets',
    label: 'Tickets',
    description: 'Support conversations',
    permission: PERMISSIONS.TICKETS_READ,
    icon: Headphones,
  },
  {
    key: 'invoices',
    to: '/invoices',
    label: 'Invoices',
    description: 'Issued billing',
    permission: PERMISSIONS.INVOICES_READ,
    icon: Receipt,
  },
  {
    key: 'employees',
    to: '/employees',
    label: 'Employees',
    description: 'People records',
    permission: PERMISSIONS.EMPLOYEES_READ,
    icon: Users,
  },
  {
    key: 'attendance',
    to: '/attendance',
    label: 'Attendance',
    description: 'Check-in records',
    permission: PERMISSIONS.ATTENDANCE_READ,
    icon: Clock,
  },
  {
    key: 'leave',
    to: '/leave',
    label: 'Leave',
    description: 'Time-off requests',
    permission: PERMISSIONS.LEAVE_READ,
    icon: CalendarDays,
  },
  {
    key: 'applications',
    to: '/applications',
    label: 'Recruitment',
    description: 'Job applications',
    permission: PERMISSIONS.APPLICATIONS_READ,
    icon: ClipboardList,
  },
  {
    key: 'documents',
    to: '/documents',
    label: 'Documents',
    description: 'Client files',
    permission: PERMISSIONS.DOCUMENTS_READ,
    icon: FileText,
  },
  {
    key: 'content',
    to: '/cms/services',
    label: 'Website',
    description: 'Public content',
    permission: PERMISSIONS.CONTENT_READ,
    icon: LayoutGrid,
  },
  {
    key: 'media',
    to: '/media',
    label: 'Media',
    description: 'Uploaded assets',
    permission: PERMISSIONS.MEDIA_READ,
    icon: Image,
  },
  {
    key: 'users',
    to: '/users',
    label: 'Users',
    description: 'Account access',
    permission: PERMISSIONS.USERS_READ,
    icon: Users,
  },
  {
    key: 'roles',
    to: '/roles',
    label: 'Roles',
    description: 'Permissions',
    permission: PERMISSIONS.ROLES_READ,
    icon: KeyRound,
  },
  {
    key: 'audit',
    to: '/audit',
    label: 'Audit',
    description: 'System events',
    permission: PERMISSIONS.AUDIT_READ,
    icon: Shield,
  },
  {
    key: 'portal-projects',
    to: '/portal/projects',
    label: 'My Projects',
    description: 'Projects linked to your account',
    permission: PERMISSIONS.PORTAL_READ,
    icon: Folder,
  },
  {
    key: 'portal-milestones',
    to: '/portal/milestones',
    label: 'Milestones',
    description: 'Upcoming delivery dates',
    permission: PERMISSIONS.PORTAL_READ,
    icon: CalendarDays,
  },
];

type ActionDef = { to: string; label: string; permission: PermissionKey; icon: LucideIcon };

const ACTIONS: ActionDef[] = [
  { to: '/projects', label: 'New Project', permission: PERMISSIONS.PROJECTS_CREATE, icon: Folder },
  { to: '/tasks', label: 'New Task', permission: PERMISSIONS.TASKS_CREATE, icon: ListTodo },
  { to: '/clients', label: 'Add Client', permission: PERMISSIONS.CLIENTS_CREATE, icon: Building2 },
  {
    to: '/invoices',
    label: 'Create Invoice',
    permission: PERMISSIONS.INVOICES_CREATE,
    icon: Receipt,
  },
  {
    to: '/employees',
    label: 'Add Employee',
    permission: PERMISSIONS.EMPLOYEES_CREATE,
    icon: Briefcase,
  },
  {
    to: '/documents',
    label: 'Upload Document',
    permission: PERMISSIONS.DOCUMENTS_CREATE,
    icon: FileText,
  },
  { to: '/tickets', label: 'New Ticket', permission: PERMISSIONS.TICKETS_CREATE, icon: Headphones },
];

function StatusPill({ label, tone }: { label: string; tone: PillTone }): ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        PILL[tone],
      )}
    >
      {label}
    </span>
  );
}

function WidgetFrame({
  title,
  action,
  isLoading,
  isError,
  onRetry,
  empty,
  children,
}: {
  title: string;
  action?: ReactNode;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  empty?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {isLoading ? (
        <div className="mt-4 flex flex-col gap-3" role="status" aria-label={`Loading ${title}`}>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Xogta lama soo gelin karin."
          retryLabel="Isku day mar kale"
          onRetry={onRetry}
        />
      ) : empty ? (
        <EmptyState title="Wax xog ah lama hayo." />
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </section>
  );
}

function KpiCard({
  label,
  value,
  context,
  trend,
  icon: Icon,
  to,
}: {
  label: string;
  value: string;
  context: string;
  trend: number | null;
  icon: LucideIcon;
  to: string;
}): ReactNode {
  return (
    <li>
      <Link
        to={to}
        className="flex h-full min-h-11 flex-col rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-muted">{label}</span>
        </div>
        <p className="mt-3 text-3xl font-semibold leading-none text-ink">{value}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <p className="text-muted">{context}</p>
          {trend !== null ? (
            <span className={trend >= 0 ? 'text-success' : 'text-error'}>
              {trend > 0 ? '+' : ''}
              {trend}%
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

export function DashboardPage(): ReactNode {
  const { data: user } = useCurrentUser();
  const [range, setRange] = useState<DashboardRange>('30d');
  const query = useDashboardOverview(range);
  const data = query.data;
  const today = formatInTimeZone(new Date(), DISPLAY_TIMEZONE, 'EEEE, d MMMM yyyy');
  const roleLabel = formatRoleName(user?.roles[0] ?? 'STAFF');
  const retry = (): void => {
    void query.refetch();
  };

  const kpis = useMemo(() => {
    if (!data) return [];
    const cards: ReactNode[] = [];
    if (data.kpis.projects) {
      cards.push(
        <KpiCard
          key="projects"
          to={data.surface === 'portal' ? '/portal/projects' : '/projects'}
          label="Total projects"
          value={String(data.kpis.projects.value)}
          context={
            data.kpis.activeProjects ? `${data.kpis.activeProjects.value} active` : 'All projects'
          }
          trend={kpiTrend(data.kpis.projects)}
          icon={Folder}
        />,
      );
    }
    if (data.kpis.openTasks) {
      cards.push(
        <KpiCard
          key="tasks"
          to="/tasks"
          label="Open tasks"
          value={String(data.kpis.openTasks.value)}
          context="Still to do, in progress, or in review"
          trend={kpiTrend(data.kpis.openTasks)}
          icon={ListTodo}
        />,
      );
    }
    if (data.kpis.openLeads) {
      cards.push(
        <KpiCard
          key="leads"
          to="/leads"
          label="Open leads"
          value={String(data.kpis.openLeads.value)}
          context="New website enquiries"
          trend={kpiTrend(data.kpis.openLeads)}
          icon={Users}
        />,
      );
    }
    if (data.kpis.activeClients) {
      cards.push(
        <KpiCard
          key="clients"
          to="/clients"
          label="Active clients"
          value={String(data.kpis.activeClients.value)}
          context="Companies currently active"
          trend={null}
          icon={Building2}
        />,
      );
    }
    if (data.kpis.openTickets) {
      cards.push(
        <KpiCard
          key="tickets"
          to="/tickets"
          label="Open tickets"
          value={String(data.kpis.openTickets.value)}
          context="Waiting on a reply or a fix"
          trend={null}
          icon={Headphones}
        />,
      );
    }
    if (data.kpis.pendingInvoices) {
      cards.push(
        <KpiCard
          key="invoices"
          to="/invoices"
          label="Pending invoices"
          value={String(data.kpis.pendingInvoices.value)}
          context="Draft, sent, partial, or overdue"
          trend={null}
          icon={Receipt}
        />,
      );
    }
    if (data.kpis.revenue) {
      cards.push(
        <KpiCard
          key="revenue"
          to="/invoices"
          label="Revenue collected"
          value={formatMoney(data.kpis.revenue.value)}
          context="Paid amount on issued invoices"
          trend={moneyTrend(data.kpis.revenue)}
          icon={Receipt}
        />,
      );
    }
    return cards;
  }, [data]);

  const modules = MODULES.filter((module) => {
    if (!hasPermission(user, module.permission)) return false;
    if (
      data?.surface === 'portal' &&
      !module.key.startsWith('portal') &&
      module.key !== 'tickets' &&
      module.key !== 'invoices' &&
      module.key !== 'documents'
    ) {
      return false;
    }
    if (data?.surface === 'internal' && module.key.startsWith('portal')) return false;
    return (
      data?.modules.some((item) => item.key === module.key) ??
      hasPermission(user, module.permission)
    );
  });
  const actions = ACTIONS.filter((action) => hasPermission(user, action.permission));
  const counts = new Map((data?.modules ?? []).map((item) => [item.key, item.count]));

  return (
    <section className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted">{today}</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight text-ink">
            {greetingForNow()}, {user?.name}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            {data?.surface === 'portal'
              ? 'Your projects, tickets, and documents in one place.'
              : "Here's what's happening across Somwave today."}
          </p>
          <span className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-brand bg-surface px-3 text-sm font-semibold text-brand">
            {roleLabel}
          </span>
        </div>
        <Select
          aria-label="Date range"
          value={range}
          onChange={(event) => setRange(event.target.value as DashboardRange)}
          options={DASHBOARD_RANGES.map((value) => ({ value, label: RANGE_LABELS[value] }))}
        />
      </header>

      {query.isLoading ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="rounded-lg border border-border bg-surface p-4">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="mt-3 h-8 w-20" />
            </li>
          ))}
        </ul>
      ) : query.isError ? (
        <ErrorState
          title="Xogta lama soo gelin karin."
          retryLabel="Isku day mar kale"
          onRetry={retry}
        />
      ) : kpis.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis}</ul>
      ) : (
        <EmptyState
          title="No metrics yet"
          description="Metrics appear here once your role can read projects, tasks, clients, or invoices."
        />
      )}

      {data?.surface === 'internal' ? (
        <InternalAnalytics
          data={data}
          loading={query.isLoading}
          error={query.isError}
          onRetry={retry}
        />
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <RecentProjects
          data={data}
          loading={query.isLoading}
          error={query.isError}
          onRetry={retry}
        />
        {data?.surface === 'portal' ? (
          <RecentTickets
            data={data}
            loading={query.isLoading}
            error={query.isError}
            onRetry={retry}
          />
        ) : (
          <RecentTasks
            data={data}
            loading={query.isLoading}
            error={query.isError}
            onRetry={retry}
          />
        )}
      </div>

      {data?.surface === 'internal' ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <RecentLeads
            data={data}
            loading={query.isLoading}
            error={query.isError}
            onRetry={retry}
          />
          <RecentTickets
            data={data}
            loading={query.isLoading}
            error={query.isError}
            onRetry={retry}
          />
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Upcoming data={data} loading={query.isLoading} error={query.isError} onRetry={retry} />
        <Activity data={data} loading={query.isLoading} error={query.isError} onRetry={retry} />
      </div>

      {actions.length > 0 ? (
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Quick actions</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link
                key={action.to + action.label}
                to={action.to}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-ink hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Plus className="h-4 w-4 text-brand" aria-hidden="true" />
                {action.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-base font-semibold text-ink">
          {data?.surface === 'portal' ? 'Your workspace' : 'Operations overview'}
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => {
            const Icon = module.icon;
            const count = counts.get(module.key);
            return (
              <li key={module.key}>
                <Link
                  to={module.to}
                  className="flex h-full min-h-11 flex-col rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <p className="mt-3 font-semibold text-ink">{module.label}</p>
                  <p className="mt-1 text-sm text-muted">{module.description}</p>
                  <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">
                    {count !== undefined && count !== null ? `${count} ` : ''}
                    View
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}

function InternalAnalytics({
  data,
  loading,
  error,
  onRetry,
}: {
  data: DashboardOverview;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}): ReactNode {
  const taskSlices = (['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const).map((key) => ({
    key,
    label: TASK_SLICE[key].label,
    className: TASK_SLICE[key].className,
    value: data.taskStatus[key] ?? 0,
  }));
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[1.4fr_0.8fr]">
      <WidgetFrame title="Project activity" isLoading={loading} isError={error} onRetry={onRetry}>
        <AreaChart points={data.series.projects} label="Projects created over time" />
      </WidgetFrame>
      <WidgetFrame title="Task status" isLoading={loading} isError={error} onRetry={onRetry}>
        <DonutChart slices={taskSlices} label="Tasks by status" />
      </WidgetFrame>
      {data.kpis.openLeads ? (
        <WidgetFrame title="New leads" isLoading={loading} isError={error} onRetry={onRetry}>
          <BarChart points={data.series.leads} label="New leads over time" />
        </WidgetFrame>
      ) : null}
      {data.kpis.pendingInvoices || data.kpis.revenue ? (
        <WidgetFrame title="Invoices" isLoading={loading} isError={error} onRetry={onRetry}>
          {hasMoneySeries(data.series.invoices) ? (
            <>
              <InvoiceChart points={data.series.invoices} label="Invoice totals and paid amounts" />
              <p className="mt-2 text-xs text-muted">
                Blue is issued totals. Green is paid amounts.
              </p>
            </>
          ) : (
            <EmptyState
              title="No data yet"
              description="Xog ku filan oo lagu sameeyo jaantuskan weli ma jirto."
            />
          )}
        </WidgetFrame>
      ) : null}
    </div>
  );
}

function RecentProjects({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: DashboardOverview;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}): ReactNode {
  const href = data?.surface === 'portal' ? '/portal/projects' : '/projects';
  const rows = data?.recent.projects ?? [];
  if (!data?.kpis.projects && !loading) return null;
  return (
    <WidgetFrame
      title="Recent projects"
      action={<ViewAll to={href} />}
      isLoading={loading}
      isError={error}
      onRetry={onRetry}
      empty={rows.length === 0}
    >
      <ul>
        {rows.map((project) => {
          const progress = projectProgress(project.taskTotal, project.taskDone);
          return (
            <li key={project.id} className="border-b border-border py-3 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{project.name}</p>
                  <p className="text-xs text-muted">
                    {project.clientName ? `Client: ${project.clientName}` : 'No client'}
                    {project.managerName ? ` · ${project.managerName}` : ''}
                  </p>
                  <p className="text-xs text-muted">
                    Due {formatLongDate(project.dueDate)}
                    {progress !== null ? ` · Progress ${progress}%` : ''}
                  </p>
                </div>
                <StatusPill
                  label={PROJECT_STATUS_LABELS_EN[project.status]}
                  tone={PROJECT_TONE[project.status] ?? 'neutral'}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetFrame>
  );
}

function RecentTasks({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: DashboardOverview;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}): ReactNode {
  const rows = data?.recent.tasks ?? [];
  if (!data?.kpis.openTasks && !loading) return null;
  return (
    <WidgetFrame
      title="Recent tasks"
      action={<ViewAll to="/tasks" />}
      isLoading={loading}
      isError={error}
      onRetry={onRetry}
      empty={rows.length === 0}
    >
      <ul>
        {rows.map((task) => (
          <li
            key={task.id}
            className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{task.title}</p>
              <p className="truncate text-xs text-muted">
                {task.projectName}
                {task.assigneeName ? ` · ${task.assigneeName}` : ''}
                {task.dueDate ? ` · Due ${formatLongDate(task.dueDate)}` : ''}
              </p>
            </div>
            <StatusPill
              label={TASK_STATUS_LABELS_EN[task.status]}
              tone={
                task.status === 'DONE'
                  ? 'success'
                  : task.status === 'IN_REVIEW'
                    ? 'warning'
                    : 'brand'
              }
            />
          </li>
        ))}
      </ul>
    </WidgetFrame>
  );
}

function RecentLeads({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: DashboardOverview;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}): ReactNode {
  const rows = data?.recent.leads ?? [];
  if (!data?.kpis.openLeads && !loading) return null;
  return (
    <WidgetFrame
      title="Recent leads"
      action={<ViewAll to="/leads" />}
      isLoading={loading}
      isError={error}
      onRetry={onRetry}
      empty={rows.length === 0}
    >
      <ul>
        {rows.map((lead) => (
          <li key={lead.id} className="border-b border-border py-3 last:border-b-0">
            <p className="font-semibold text-ink">{lead.name}</p>
            <p className="text-xs text-muted">
              {lead.email} · {lead.status} · {formatLongDate(lead.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </WidgetFrame>
  );
}

function RecentTickets({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: DashboardOverview;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}): ReactNode {
  const rows = data?.recent.tickets ?? [];
  if (!data?.kpis.openTickets && !loading) return null;
  const summary = data
    ? [
        ['Open', data.ticketStatus.OPEN ?? 0],
        ['In progress', data.ticketStatus.IN_PROGRESS ?? 0],
        ['Waiting', data.ticketStatus.WAITING ?? 0],
        ['Resolved', data.ticketStatus.RESOLVED ?? 0],
      ]
    : [];
  return (
    <WidgetFrame
      title="Support"
      action={<ViewAll to="/tickets" />}
      isLoading={loading}
      isError={error}
      onRetry={onRetry}
      empty={rows.length === 0 && summary.every(([, count]) => count === 0)}
    >
      <ul className="mb-3 grid grid-cols-2 gap-2 text-sm">
        {summary.map(([label, count]) => (
          <li key={label} className="rounded-md bg-canvas px-3 py-2 text-muted">
            {label}
            <span className="ms-2 font-semibold text-ink">{count}</span>
          </li>
        ))}
      </ul>
      <ul>
        {rows.map((ticket) => (
          <li key={ticket.id} className="border-b border-border py-3 last:border-b-0">
            <p className="truncate font-semibold text-ink">{ticket.subject}</p>
            <p className="text-xs text-muted">
              {ticket.code} · {TICKET_STATUS_LABELS_EN[ticket.status]} · {ticket.clientName}
            </p>
          </li>
        ))}
      </ul>
    </WidgetFrame>
  );
}

function Upcoming({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: DashboardOverview;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}): ReactNode {
  const rows = data?.upcoming ?? [];
  return (
    <WidgetFrame
      title="Upcoming"
      isLoading={loading}
      isError={error}
      onRetry={onRetry}
      empty={rows.length === 0}
    >
      <ol className="border-s border-border ps-4">
        {rows.map((item) => (
          <li key={item.id} className="relative pb-4 last:pb-0">
            <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
            <p className="text-xs font-medium text-muted">{formatLongDate(item.dueDate)}</p>
            <Link to={item.href} className="font-semibold text-ink hover:text-brand">
              {item.title}
            </Link>
            {item.meta ? <p className="text-xs text-muted">{item.meta}</p> : null}
          </li>
        ))}
      </ol>
    </WidgetFrame>
  );
}

function Activity({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: DashboardOverview;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}): ReactNode {
  const rows = data?.activity ?? [];
  return (
    <WidgetFrame
      title="Recent activity"
      isLoading={loading}
      isError={error}
      onRetry={onRetry}
      empty={rows.length === 0}
    >
      <ul>
        {rows.map((item) => (
          <li key={item.id} className="border-b border-border py-3 last:border-b-0">
            <p className="font-medium text-ink">{activityLabel(item.action, item.subjectType)}</p>
            <p className="text-xs text-muted">{formatLongDate(item.createdAt)}</p>
          </li>
        ))}
      </ul>
    </WidgetFrame>
  );
}

function ViewAll({ to }: { to: string }): ReactNode {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      View all
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
