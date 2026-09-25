import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import {
  Building2,
  FileText,
  Folder,
  Headphones,
  ListTodo,
  Receipt,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  PERMISSIONS,
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TICKET_STATUS_LABELS,
  type AuthUser,
  type DashboardPayload,
  type DashboardRange,
} from '@somwave/shared';
import { hasPermission } from '../../lib/rbac';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { DISPLAY_TIMEZONE, formatDate } from '../../lib/date';
import { formatRoleName } from '../../lib/name';
import { AreaChart, BarChart, DonutChart } from './components/Charts';
import { KpiCard } from './components/KpiCard';
import { ChartEmpty, Widget, WidgetEmpty, WidgetError, WidgetSkeleton } from './components/Widget';
import {
  DASHBOARD_RANGE_OPTIONS,
  MODULE_COPY,
  formatUsd,
  greetingFor,
  seriesHasValues,
  visibleQuickActions,
} from './metrics';

const MODULE_ICONS: Record<string, LucideIcon> = {
  projects: Folder,
  tasks: ListTodo,
  milestones: Folder,
  timesheets: FileText,
  clients: Building2,
  leads: Users,
  tickets: Headphones,
  invoices: Receipt,
  employees: Users,
  attendance: Users,
  leave: FileText,
  applications: FileText,
  documents: FileText,
  users: Users,
  roles: Users,
  audit: FileText,
  services: Folder,
  posts: FileText,
};

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'ACTIVE' || status === 'DONE' || status === 'RESOLVED' || status === 'PAID') {
    return 'success';
  }
  if (status === 'IN_PROGRESS' || status === 'IN_REVIEW' || status === 'WAITING') return 'warning';
  if (status === 'OVERDUE' || status === 'CANCELLED' || status === 'URGENT') return 'error';
  if (status === 'OPEN' || status === 'NEW' || status === 'PLANNING') return 'info';
  return 'neutral';
}

export function InternalDashboard({
  user,
  data,
  range,
  onRangeChange,
  isLoading,
  isError,
  onRetry,
}: {
  user: AuthUser | null | undefined;
  data: DashboardPayload | undefined;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}): ReactNode {
  const hour = Number(formatInTimeZone(new Date(), DISPLAY_TIMEZONE, 'H'));
  const today = formatInTimeZone(new Date(), DISPLAY_TIMEZONE, 'EEEE, d MMMM yyyy');
  const actions = visibleQuickActions(user);
  const kpis = data?.kpis;
  const showProjects = hasPermission(user, PERMISSIONS.PROJECTS_READ);
  const showTasks = hasPermission(user, PERMISSIONS.TASKS_READ);
  const showLeads = hasPermission(user, PERMISSIONS.LEADS_READ);
  const showTickets = hasPermission(user, PERMISSIONS.TICKETS_READ);
  const showInvoices = hasPermission(user, PERMISSIONS.INVOICES_READ);
  const showClients = hasPermission(user, PERMISSIONS.CLIENTS_READ);

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted">{today}</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight text-ink">
            {greetingFor(hour)}, {user?.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Here&apos;s what&apos;s happening across Somwave today.
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-brand">
            {formatRoleName(user?.roles[0] ?? 'STAFF')}
          </p>
        </div>
        <Select
          aria-label="Date range"
          value={range}
          onChange={(event) => onRangeChange(event.target.value as DashboardRange)}
          options={DASHBOARD_RANGE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showProjects ? (
          <KpiCard
            label="Total projects"
            to="/projects"
            icon={Folder}
            kpi={kpis?.projects}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {showProjects ? (
          <KpiCard
            label="Active projects"
            to="/projects"
            icon={Folder}
            kpi={kpis?.activeProjects}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {showTasks ? (
          <KpiCard
            label="Open tasks"
            to="/tasks"
            icon={ListTodo}
            kpi={kpis?.openTasks}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {showLeads ? (
          <KpiCard
            label="Open leads"
            to="/leads"
            icon={Users}
            kpi={kpis?.openLeads}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {showClients ? (
          <KpiCard
            label="Active clients"
            to="/clients"
            icon={Building2}
            kpi={kpis?.activeClients}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {showTickets ? (
          <KpiCard
            label="Open tickets"
            to="/tickets"
            icon={Headphones}
            kpi={kpis?.openTickets}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {showInvoices ? (
          <KpiCard
            label="Pending invoices"
            to="/invoices"
            icon={Receipt}
            kpi={kpis?.pendingInvoices}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {showInvoices ? (
          <KpiCard
            label="Revenue"
            to="/invoices"
            icon={Receipt}
            kpi={kpis?.revenue}
            formatValue={formatUsd}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
      </ul>

      {!showProjects && !showTasks && !showLeads && !showTickets && !showInvoices ? (
        <p className="text-sm text-muted">No operational metrics are available for this account.</p>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {showProjects || showLeads || isLoading ? (
          <Widget title="Project activity">
            {isLoading ? (
              <WidgetSkeleton />
            ) : isError ? (
              <WidgetError onRetry={onRetry} />
            ) : data && seriesHasValues(data.series.projectActivity) ? (
              <AreaChart points={data.series.projectActivity} label="Project activity" />
            ) : data && seriesHasValues(data.series.leads) ? (
              <BarChart points={data.series.leads} label="New leads" />
            ) : (
              <ChartEmpty />
            )}
          </Widget>
        ) : null}
        {showTasks || isLoading ? (
          <Widget title="Task status">
            {isLoading ? (
              <WidgetSkeleton />
            ) : isError ? (
              <WidgetError onRetry={onRetry} />
            ) : (
              <DonutChart slices={data?.taskStatus ?? []} label="Task status" />
            )}
          </Widget>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {showProjects || isLoading ? (
          <Widget title="Recent projects" action={{ to: '/projects', label: 'View project' }}>
            {isLoading ? (
              <WidgetSkeleton />
            ) : isError ? (
              <WidgetError onRetry={onRetry} />
            ) : !data?.recent.projects.length ? (
              <WidgetEmpty />
            ) : (
              <ul>
                {data.recent.projects.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{project.name}</p>
                      <p className="text-xs text-muted">
                        {project.clientName ? `Client: ${project.clientName}` : 'No client'}
                        {project.ownerName ? ` · ${project.ownerName}` : ''}
                      </p>
                      <p className="text-xs text-muted">
                        Due {formatDate(project.dueDate)}
                        {project.progress !== null ? ` · Progress ${project.progress}%` : ''}
                      </p>
                    </div>
                    <Badge tone={statusTone(project.status)}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        ) : null}

        {showTasks || isLoading ? (
          <Widget title="Recent tasks" action={{ to: '/tasks', label: 'View all' }}>
            {isLoading ? (
              <WidgetSkeleton />
            ) : isError ? (
              <WidgetError onRetry={onRetry} />
            ) : !data?.recent.tasks.length ? (
              <WidgetEmpty />
            ) : (
              <ul>
                {data.recent.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{task.title}</p>
                      <p className="truncate text-xs text-muted">
                        {task.projectName}
                        {task.assigneeName ? ` · ${task.assigneeName}` : ''}
                      </p>
                      <p className="text-xs text-muted">
                        {TASK_PRIORITY_LABELS[task.priority]} · Due {formatDate(task.dueDate)}
                      </p>
                    </div>
                    <Badge tone={statusTone(task.status)}>{TASK_STATUS_LABELS[task.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {showLeads ? (
          <Widget title="Recent leads" action={{ to: '/leads', label: 'View all leads' }}>
            {isLoading ? (
              <WidgetSkeleton />
            ) : isError ? (
              <WidgetError onRetry={onRetry} />
            ) : !data?.recent.leads.length ? (
              <WidgetEmpty />
            ) : (
              <ul>
                {data.recent.leads.map((lead) => (
                  <li key={lead.id} className="border-b border-border py-3 last:border-b-0">
                    <p className="truncate text-sm font-semibold text-ink">{lead.name}</p>
                    <p className="text-xs text-muted">
                      {lead.source} · {lead.status} · {formatDate(lead.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        ) : null}

        {showTickets ? (
          <Widget title="Support" action={{ to: '/tickets', label: 'View tickets' }}>
            {isLoading ? (
              <WidgetSkeleton />
            ) : isError ? (
              <WidgetError onRetry={onRetry} />
            ) : (
              <>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {data?.ticketStatus.map((slice) => (
                    <li key={slice.key} className="rounded-lg bg-canvas px-3 py-2">
                      <p className="text-xs text-muted">
                        {TICKET_STATUS_LABELS[slice.key as keyof typeof TICKET_STATUS_LABELS] ??
                          slice.label}
                      </p>
                      <p className="text-lg font-semibold text-ink">{slice.value}</p>
                    </li>
                  ))}
                </ul>
                {data?.recent.tickets.length ? (
                  <ul className="mt-4">
                    {data.recent.tickets.slice(0, 4).map((ticket) => (
                      <li key={ticket.id} className="border-b border-border py-3 last:border-b-0">
                        <p className="truncate text-sm font-semibold text-ink">{ticket.subject}</p>
                        <p className="text-xs text-muted">
                          {ticket.code} · {ticket.clientName}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <WidgetEmpty />
                )}
              </>
            )}
          </Widget>
        ) : null}
      </div>

      {showInvoices ? (
        <Widget title="Invoices">
          {isLoading ? (
            <WidgetSkeleton />
          ) : isError ? (
            <WidgetError onRetry={onRetry} />
          ) : (
            <AreaChart points={data?.series.invoices ?? []} label="Invoice totals" />
          )}
        </Widget>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Widget title="Upcoming">
          {isLoading ? (
            <WidgetSkeleton />
          ) : isError ? (
            <WidgetError onRetry={onRetry} />
          ) : !data?.upcoming.length ? (
            <WidgetEmpty />
          ) : (
            <ol className="border-s border-border ps-4">
              {data.upcoming.map((item) => (
                <li key={item.id} className="relative pb-4 last:pb-0">
                  <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                  <p className="text-xs font-medium text-muted">{formatDate(item.date)}</p>
                  <Link
                    to={item.href}
                    className="text-sm font-semibold text-ink hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Widget>
        <Widget title="Recent activity">
          {isLoading ? (
            <WidgetSkeleton />
          ) : isError ? (
            <WidgetError onRetry={onRetry} />
          ) : !data?.activity.length ? (
            <WidgetEmpty />
          ) : (
            <ul>
              {data.activity.map((item) => (
                <li key={item.id} className="border-b border-border py-3 last:border-b-0">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-xs text-muted">
                    {item.detail ? `${item.detail} · ` : ''}
                    {formatDate(item.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>

      {actions.length ? (
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Quick actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-medium text-ink hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                + {action.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {data?.modules.length ? (
        <section>
          <h2 className="text-base font-semibold text-ink">Your workspace</h2>
          <p className="mt-1 text-sm text-muted">Modules you are authorized to open.</p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.modules.map((module) => {
              const copy = MODULE_COPY[module.key] ?? {
                title: module.key,
                description: 'Open this module',
              };
              const Icon = MODULE_ICONS[module.key] ?? Folder;
              return (
                <li key={module.key}>
                  <Link
                    to={module.to}
                    className="flex h-full flex-col rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-ink">{copy.title}</p>
                    <p className="mt-1 text-xs text-muted">{copy.description}</p>
                    <p className="mt-3 text-sm font-medium text-brand">
                      {module.count !== null ? `${module.count} · ` : ''}
                      View →
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
