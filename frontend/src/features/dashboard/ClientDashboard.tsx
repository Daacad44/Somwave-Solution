import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { FileText, Folder, Headphones, Receipt } from 'lucide-react';
import {
  PROJECT_STATUS_LABELS,
  TICKET_STATUS_LABELS,
  type AuthUser,
  type DashboardPayload,
} from '@somwave/shared';
import { Badge } from '../../components/ui/Badge';
import { DISPLAY_TIMEZONE, formatDate } from '../../lib/date';
import { KpiCard } from './components/KpiCard';
import { Widget, WidgetEmpty, WidgetError, WidgetSkeleton } from './components/Widget';
import { MODULE_COPY, formatUsd, greetingFor } from './metrics';

export function ClientDashboard({
  user,
  data,
  isLoading,
  isError,
  onRetry,
}: {
  user: AuthUser | null | undefined;
  data: DashboardPayload | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}): ReactNode {
  const hour = Number(formatInTimeZone(new Date(), DISPLAY_TIMEZONE, 'H'));
  const kpis = data?.kpis;

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight text-ink">
          {greetingFor(hour)}, {user?.name}
        </h1>
        <p className="mt-1 text-sm text-muted">Your projects, tickets, documents, and invoices.</p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis?.projects ? (
          <KpiCard
            label="My projects"
            to="/portal/projects"
            icon={Folder}
            kpi={kpis.projects}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {kpis?.openTickets ? (
          <KpiCard
            label="My tickets"
            to="/tickets"
            icon={Headphones}
            kpi={kpis.openTickets}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {kpis?.pendingInvoices ? (
          <KpiCard
            label="Invoices"
            to="/invoices"
            icon={Receipt}
            kpi={kpis.pendingInvoices}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {kpis?.documents ? (
          <KpiCard
            label="Documents"
            to="/documents"
            icon={FileText}
            kpi={kpis.documents}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {kpis?.revenue ? (
          <KpiCard
            label="Paid"
            to="/invoices"
            icon={Receipt}
            kpi={kpis.revenue}
            formatValue={formatUsd}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
      </ul>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Widget title="My projects" action={{ to: '/portal/projects', label: 'View project' }}>
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
                    <p className="text-xs text-muted">Due {formatDate(project.dueDate)}</p>
                  </div>
                  <Badge tone="info">{PROJECT_STATUS_LABELS[project.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Widget>
        <Widget
          title="Upcoming milestones"
          action={{ to: '/portal/milestones', label: 'View all' }}
        >
          {isLoading ? (
            <WidgetSkeleton />
          ) : isError ? (
            <WidgetError onRetry={onRetry} />
          ) : !data?.upcoming.length ? (
            <WidgetEmpty />
          ) : (
            <ol className="border-s border-border ps-4">
              {data.upcoming.map((item) => (
                <li key={item.id} className="pb-4 last:pb-0">
                  <p className="text-xs text-muted">{formatDate(item.date)}</p>
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                </li>
              ))}
            </ol>
          )}
        </Widget>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Widget title="My tickets" action={{ to: '/tickets', label: 'View tickets' }}>
          {isLoading ? (
            <WidgetSkeleton />
          ) : isError ? (
            <WidgetError onRetry={onRetry} />
          ) : (
            <>
              {data?.ticketStatus.length ? (
                <ul className="mb-4 grid grid-cols-2 gap-2 text-sm">
                  {data.ticketStatus.map((slice) => (
                    <li key={slice.key} className="rounded-lg bg-canvas px-3 py-2">
                      <p className="text-xs text-muted">
                        {TICKET_STATUS_LABELS[slice.key as keyof typeof TICKET_STATUS_LABELS] ??
                          slice.label}
                      </p>
                      <p className="text-lg font-semibold text-ink">{slice.value}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!data?.recent.tickets.length ? (
                <WidgetEmpty />
              ) : (
                <ul>
                  {data.recent.tickets.map((ticket) => (
                    <li key={ticket.id} className="border-b border-border py-3 last:border-b-0">
                      <p className="text-sm font-semibold text-ink">{ticket.subject}</p>
                      <p className="text-xs text-muted">{ticket.code}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Widget>
        <Widget title="My documents" action={{ to: '/documents', label: 'View documents' }}>
          {isLoading ? (
            <WidgetSkeleton />
          ) : isError ? (
            <WidgetError onRetry={onRetry} />
          ) : !data?.recent.documents.length ? (
            <WidgetEmpty />
          ) : (
            <ul>
              {data.recent.documents.map((doc) => (
                <li key={doc.id} className="border-b border-border py-3 last:border-b-0">
                  <p className="text-sm font-semibold text-ink">{doc.title}</p>
                  <p className="text-xs text-muted">{formatDate(doc.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>

      <Widget title="Invoices" action={{ to: '/invoices', label: 'View invoices' }}>
        {isLoading ? (
          <WidgetSkeleton />
        ) : isError ? (
          <WidgetError onRetry={onRetry} />
        ) : !data?.recent.invoices.length ? (
          <WidgetEmpty />
        ) : (
          <ul>
            {data.recent.invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{invoice.number}</p>
                  <p className="text-xs text-muted">Due {formatDate(invoice.dueDate)}</p>
                </div>
                <p className="text-sm font-medium text-ink">${invoice.total}</p>
              </li>
            ))}
          </ul>
        )}
      </Widget>

      {data?.modules.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.modules.map((module) => {
            const copy = MODULE_COPY[module.key] ?? { title: module.key, description: '' };
            return (
              <li key={module.key}>
                <Link
                  to={module.to}
                  className="block rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-brand"
                >
                  <p className="text-sm font-semibold text-ink">{copy.title}</p>
                  <p className="text-xs text-muted">{copy.description}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
