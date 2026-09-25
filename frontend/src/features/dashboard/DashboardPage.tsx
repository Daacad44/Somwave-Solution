import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import {
  ArrowRight,
  FileText,
  Folder,
  Headphones,
  Home,
  ListTodo,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ProjectStatus, TaskStatus } from '@somwave/shared';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/states';
import { useCurrentUser } from '../auth/hooks';
import { DISPLAY_TIMEZONE, formatDate } from '../../lib/date';
import { cn } from '../../lib/cn';
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

type PillTone = 'success' | 'brand' | 'warning' | 'neutral';

const PROJECT_TONE: Record<ProjectStatus, PillTone> = {
  PLANNING: 'brand',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

const TASK_TONE: Record<TaskStatus, PillTone> = {
  TODO: 'neutral',
  IN_PROGRESS: 'brand',
  IN_REVIEW: 'warning',
  DONE: 'success',
};

const PILL: Record<PillTone, string> = {
  success: 'bg-success-soft text-success',
  brand: 'bg-brand-soft text-brand',
  warning: 'bg-warning-soft text-warning',
  neutral: 'bg-canvas text-muted',
};

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

function Sparkline({ d, className }: { d: string; className: string }): ReactNode {
  return (
    <svg className={cn('h-8 w-16 shrink-0', className)} viewBox="0 0 64 32" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WelcomeWave(): ReactNode {
  return (
    <svg
      className="pointer-events-none absolute end-0 top-0 hidden h-full w-[48%] text-brand lg:block"
      viewBox="0 0 520 240"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 170C110 110 170 40 270 78C350 108 400 30 520 58"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1.6"
      />
      <path
        d="M0 200C100 140 180 70 280 120C370 164 420 90 520 110"
        stroke="currentColor"
        strokeOpacity="0.16"
        strokeWidth="1.6"
      />
      <path
        d="M80 80C150 40 210 90 280 50"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="1.4"
      />
      {[
        [430, 46],
        [448, 62],
        [466, 40],
        [484, 58],
        [456, 28],
      ].map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="3.2"
          fill="currentColor"
          fillOpacity="0.85"
        />
      ))}
    </svg>
  );
}

function ProjectThumb({ index }: { index: number }): ReactNode {
  const scenes = [
    'M6 18h20v8H6zM8 10h16v6H8z',
    'M6 8h20v16H6zM10 12h12M10 16h8',
    'M8 6h16v20H8zM12 10h8M12 14h8M12 18h5',
  ];
  return (
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
        <path
          d={scenes[index % scenes.length]}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
  spark,
  sparkClass,
  to,
  isLoading,
  isError,
}: {
  label: string;
  value: number | null;
  hint: string;
  icon: LucideIcon;
  iconClass: string;
  spark: string;
  sparkClass: string;
  to: string;
  isLoading: boolean;
  isError: boolean;
}): ReactNode {
  return (
    <li>
      <Link
        to={to}
        className="flex h-full min-h-11 flex-col rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-lg',
                iconClass,
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-muted">{label}</span>
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="mt-3 h-8 w-16" />
        ) : isError ? (
          <p className="mt-3 text-sm font-medium text-error">Unavailable</p>
        ) : (
          <p className="mt-3 text-3xl font-semibold leading-none text-ink">{value}</p>
        )}
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="text-sm text-muted">{hint}</p>
          <Sparkline d={spark} className={sparkClass} />
        </div>
      </Link>
    </li>
  );
}

export function DashboardPage(): ReactNode {
  const { data: user } = useCurrentUser();
  const dash = useDashboard(user);
  const today = formatInTimeZone(new Date(), DISPLAY_TIMEZONE, 'EEEE, d MMMM yyyy');
  const leadCounts = dash.leads.data ? countLeads(dash.leads.data) : null;
  const invoiceCounts = dash.invoices.data ? countInvoices(dash.invoices.data) : null;
  const openTasks =
    dash.tasks.data && dash.doneTasks.data
      ? countOpenTasks(dash.tasks.data.meta.total, dash.doneTasks.data.meta.total)
      : null;
  const openTickets = dash.tickets.data ? countOpenTickets(dash.tickets.data) : null;
  const roleLabel = formatRoleName(user?.roles[0] ?? 'SUPER_ADMIN');
  const projects = dash.projects.data?.data.slice(0, 3) ?? [];
  const tasks = dash.tasks.data?.data.slice(0, 3) ?? [];

  return (
    <section className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <Home className="h-4 w-4" aria-hidden="true" />
          <span aria-current="page">Home</span>
        </p>
        <p className="text-sm text-muted">{today}</p>
      </div>

      <section className="relative overflow-hidden rounded-lg border border-brand-soft bg-banner shadow-sm">
        <WelcomeWave />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1.35fr_0.8fr] lg:items-center lg:p-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              Good to see you
            </p>
            <h1 className="mt-2 text-[28px] font-bold leading-tight text-ink">
              Welcome back, <span className="text-brand">{user?.name}</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              Your workspace at a glance. Figures and shortcuts below are limited to the areas you
              can access.
            </p>
            <span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand bg-surface px-3 text-sm font-semibold text-brand">
              <Shield className="h-4 w-4" aria-hidden="true" />
              {roleLabel}
            </span>
          </div>
          <div className="lg:text-end">
            <p className="text-lg font-medium leading-snug text-ink">
              “Better Systems
              <br />
              Brighter Tomorrows”
            </p>
            <p className="mt-2 text-sm text-muted">Somwave Solution</p>
          </div>
        </div>
      </section>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Overview</h2>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dash.portalProjectsEnabled ? (
            <MetricCard
              label="My projects"
              to="/portal/projects"
              value={dash.portalProjects.data?.length ?? null}
              hint="Projects linked to your account"
              icon={Folder}
              iconClass="bg-brand-soft text-brand"
              spark="M2 22 L14 18 L24 20 L36 12 L46 14 L62 6"
              sparkClass="text-brand"
              isLoading={dash.portalProjects.isLoading}
              isError={dash.portalProjects.isError}
            />
          ) : null}
          {dash.projectsEnabled ? (
            <MetricCard
              label="Projects"
              to="/projects"
              value={dash.projects.data?.meta.total ?? null}
              hint={
                dash.activeProjects.data
                  ? `${dash.activeProjects.data.meta.total} active`
                  : 'Active projects'
              }
              icon={Folder}
              iconClass="bg-brand-soft text-brand"
              spark="M2 22 L14 18 L24 20 L36 12 L46 14 L62 6"
              sparkClass="text-brand"
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
              icon={ListTodo}
              iconClass="bg-warning-soft text-warning"
              spark="M2 20 L12 22 L24 14 L34 16 L46 8 L62 12"
              sparkClass="text-warning"
              isLoading={dash.tasks.isLoading || dash.doneTasks.isLoading}
              isError={dash.tasks.isError || dash.doneTasks.isError}
            />
          ) : null}
          {dash.leadsEnabled ? (
            <MetricCard
              label="Leads"
              to="/leads"
              value={leadCounts?.total ?? null}
              hint={leadCounts ? `${leadCounts.fresh} new` : 'New enquiries'}
              icon={Users}
              iconClass="bg-brand-soft text-brand"
              spark="M2 24 L16 20 L26 18 L38 10 L50 8 L62 4"
              sparkClass="text-brand"
              isLoading={dash.leads.isLoading}
              isError={dash.leads.isError}
            />
          ) : null}
          {dash.invoicesEnabled ? (
            <MetricCard
              label="Open invoices"
              to="/invoices"
              value={invoiceCounts?.open ?? null}
              hint={invoiceCounts ? `${invoiceCounts.overdue} overdue` : 'Still open'}
              icon={FileText}
              iconClass="bg-invoice-soft text-invoice"
              spark="M2 10 L14 12 L26 8 L36 18 L48 16 L62 24"
              sparkClass="text-invoice"
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
              icon={Headphones}
              iconClass="bg-success-soft text-success"
              spark="M2 16 L14 18 L26 14 L38 16 L50 12 L62 14"
              sparkClass="text-success"
              isLoading={dash.tickets.isLoading}
              isError={dash.tickets.isError}
            />
          ) : null}
        </ul>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {dash.projectsEnabled ? (
          <section className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <Folder className="h-4 w-4 text-brand" aria-hidden="true" />
                Recent projects
              </h2>
              <Link
                to="/projects"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                View all
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {dash.projects.isLoading ? (
              <div className="mt-4 flex flex-col gap-3" role="status" aria-label="Loading projects">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : dash.projects.isError ? (
              <ErrorState
                description="Projects could not be loaded."
                onRetry={() => void dash.projects.refetch()}
              />
            ) : projects.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No projects yet.</p>
            ) : (
              <ul className="mt-2">
                {projects.map((project, index) => (
                  <li
                    key={project.id}
                    className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
                  >
                    <ProjectThumb index={index} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{project.name}</p>
                      <p className="text-xs text-muted">
                        {project.dueDate ? `Due ${formatDate(project.dueDate)}` : 'No due date'}
                      </p>
                    </div>
                    <StatusPill
                      label={PROJECT_STATUS_LABELS_EN[project.status]}
                      tone={PROJECT_TONE[project.status]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {dash.tasksEnabled ? (
          <section className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <ListTodo className="h-4 w-4 text-brand" aria-hidden="true" />
                Recent tasks
              </h2>
              <Link
                to="/tasks"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                View all
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {dash.tasks.isLoading ? (
              <div className="mt-4 flex flex-col gap-3" role="status" aria-label="Loading tasks">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : dash.tasks.isError ? (
              <ErrorState
                description="Tasks could not be loaded."
                onRetry={() => void dash.tasks.refetch()}
              />
            ) : tasks.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No tasks yet.</p>
            ) : (
              <ul className="mt-2">
                {tasks.map((task, index) => {
                  const TaskIcon = [ListTodo, Headphones, FileText][index % 3] ?? ListTodo;
                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
                    >
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted">
                        <TaskIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{task.title}</p>
                        <p className="truncate text-xs text-muted">{task.project.name}</p>
                      </div>
                      <StatusPill
                        label={TASK_STATUS_LABELS_EN[task.status]}
                        tone={TASK_TONE[task.status]}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </section>
  );
}
