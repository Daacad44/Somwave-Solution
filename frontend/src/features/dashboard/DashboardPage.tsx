import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import type { ProjectStatus, TaskStatus } from '@somwave/shared';
import { NAV_GROUPS } from '../../app/layout/nav';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/states';
import { useCurrentUser } from '../auth/hooks';
import { hasPermission } from '../../lib/rbac';
import { DISPLAY_TIMEZONE, formatDate } from '../../lib/date';
import { useDashboard } from './hooks';
import {
  PROJECT_STATUS_LABELS_EN,
  TASK_STATUS_LABELS_EN,
  countInvoices,
  countLeads,
  countOpenTasks,
  countOpenTickets,
  formatRoleName,
} from './metrics';

const PROJECT_TONE: Record<ProjectStatus, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  PLANNING: 'neutral',
  ACTIVE: 'info',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const TASK_TONE: Record<TaskStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  IN_REVIEW: 'warning',
  DONE: 'success',
};

function MetricCard({
  label,
  value,
  hint,
  to,
  isLoading,
  isError,
}: {
  label: string;
  value: number | null;
  hint: string;
  to: string;
  isLoading: boolean;
  isError: boolean;
}): ReactNode {
  return (
    <li>
      <Link
        to={to}
        className="flex h-full min-h-11 flex-col rounded-lg border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <p className="text-sm font-medium text-muted">{label}</p>
        {isLoading ? (
          <Skeleton className="mt-3 h-8 w-16" />
        ) : isError ? (
          <p className="mt-3 text-sm font-medium text-error">Unavailable</p>
        ) : (
          <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
        )}
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </Link>
    </li>
  );
}

export function DashboardPage(): ReactNode {
  const { data: user } = useCurrentUser();
  const dash = useDashboard(user);
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(user, item.permission)),
  })).filter((group) => group.items.length > 0);

  const today = formatInTimeZone(new Date(), DISPLAY_TIMEZONE, 'EEEE, d MMMM yyyy');
  const leadCounts = dash.leads.data ? countLeads(dash.leads.data) : null;
  const invoiceCounts = dash.invoices.data ? countInvoices(dash.invoices.data) : null;
  const openTasks =
    dash.tasks.data && dash.doneTasks.data
      ? countOpenTasks(dash.tasks.data.meta.total, dash.doneTasks.data.meta.total)
      : null;
  const openTickets = dash.tickets.data ? countOpenTickets(dash.tickets.data) : null;

  const showMetrics =
    dash.projectsEnabled ||
    dash.tasksEnabled ||
    dash.leadsEnabled ||
    dash.invoicesEnabled ||
    dash.ticketsEnabled;
  const metricsFailed =
    (dash.projectsEnabled && (dash.projects.isError || dash.activeProjects.isError)) ||
    (dash.tasksEnabled && (dash.tasks.isError || dash.doneTasks.isError)) ||
    (dash.leadsEnabled && dash.leads.isError) ||
    (dash.invoicesEnabled && dash.invoices.isError) ||
    (dash.ticketsEnabled && dash.tickets.isError);

  return (
    <section className="flex flex-col gap-6">
      <header className="rounded-lg border border-border border-s-4 border-s-accent bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium text-muted">{today}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Welcome back, {user?.name}</h1>
        <p className="mt-1 max-w-2xl text-base text-muted">
          Your workspace at a glance. Figures and shortcuts below are limited to the areas you can
          access.
        </p>
        {user && user.roles.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <li key={role}>
                <Badge tone="info">{formatRoleName(role)}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {showMetrics ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Overview</h2>
            {metricsFailed ? (
              <Button variant="secondary" size="sm" onClick={dash.refetchMetrics}>
                Try again
              </Button>
            ) : null}
          </div>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dash.projectsEnabled ? (
              <MetricCard
                label="Projects"
                to="/projects"
                value={dash.projects.data?.meta.total ?? null}
                hint={
                  dash.activeProjects.data
                    ? `${dash.activeProjects.data.meta.total} active`
                    : 'All projects'
                }
                isLoading={dash.projects.isLoading || dash.activeProjects.isLoading}
                isError={dash.projects.isError || dash.activeProjects.isError}
              />
            ) : null}
            {dash.tasksEnabled ? (
              <MetricCard
                label="Open tasks"
                to="/tasks"
                value={openTasks}
                hint="Still to do, in progress, or in review"
                isLoading={dash.tasks.isLoading || dash.doneTasks.isLoading}
                isError={dash.tasks.isError || dash.doneTasks.isError}
              />
            ) : null}
            {dash.leadsEnabled ? (
              <MetricCard
                label="Leads"
                to="/leads"
                value={leadCounts?.total ?? null}
                hint={leadCounts ? `${leadCounts.fresh} new` : 'Contact form enquiries'}
                isLoading={dash.leads.isLoading}
                isError={dash.leads.isError}
              />
            ) : null}
            {dash.invoicesEnabled ? (
              <MetricCard
                label="Open invoices"
                to="/invoices"
                value={invoiceCounts?.open ?? null}
                hint={invoiceCounts ? `${invoiceCounts.overdue} overdue` : 'Draft, sent, or unpaid'}
                isLoading={dash.invoices.isLoading}
                isError={dash.invoices.isError}
              />
            ) : null}
            {dash.ticketsEnabled ? (
              <MetricCard
                label="Open tickets"
                to="/tickets"
                value={openTickets}
                hint="Waiting on a reply or a fix"
                isLoading={dash.tickets.isLoading}
                isError={dash.tickets.isError}
              />
            ) : null}
          </ul>
        </div>
      ) : null}

      {dash.projectsEnabled || dash.tasksEnabled ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {dash.projectsEnabled ? (
            <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Recent projects</h2>
                <Link
                  to="/projects"
                  className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  View all
                </Link>
              </div>
              {dash.projects.isLoading ? (
                <div
                  className="mt-4 flex flex-col gap-3"
                  role="status"
                  aria-label="Loading projects"
                >
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : dash.projects.isError ? (
                <ErrorState
                  description="Projects could not be loaded."
                  onRetry={() => void dash.projects.refetch()}
                />
              ) : dash.projects.data && dash.projects.data.data.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No projects yet.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {dash.projects.data?.data.map((project) => (
                    <li
                      key={project.id}
                      className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{project.name}</p>
                        <p className="text-sm text-muted">
                          {project.dueDate ? `Due ${formatDate(project.dueDate)}` : 'No due date'}
                        </p>
                      </div>
                      <Badge tone={PROJECT_TONE[project.status]}>
                        {PROJECT_STATUS_LABELS_EN[project.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {dash.tasksEnabled ? (
            <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Recent tasks</h2>
                <Link
                  to="/tasks"
                  className="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  View all
                </Link>
              </div>
              {dash.tasks.isLoading ? (
                <div className="mt-4 flex flex-col gap-3" role="status" aria-label="Loading tasks">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : dash.tasks.isError ? (
                <ErrorState
                  description="Tasks could not be loaded."
                  onRetry={() => void dash.tasks.refetch()}
                />
              ) : dash.tasks.data && dash.tasks.data.data.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No tasks yet.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {dash.tasks.data?.data.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                        <p className="truncate text-sm text-muted">{task.project.name}</p>
                      </div>
                      <Badge tone={TASK_TONE[task.status]}>
                        {TASK_STATUS_LABELS_EN[task.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          title="No areas available"
          description="This account cannot open any workspace area yet. Contact an administrator."
        />
      ) : (
        groups.map((group) => (
          <div key={group.heading}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {group.heading}
            </h2>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2">
              {group.items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="block min-h-11 rounded-lg border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <h3 className="text-lg font-semibold text-ink">{item.label}</h3>
                    <p className="mt-1 text-sm text-muted">{item.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
