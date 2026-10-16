import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { reportsApi, type ReportFilters, type ReportRow } from './api';

const PAGE_SIZE = 25;
const fieldClass =
  'h-11 w-full rounded-md border border-border bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

function defaultPeriod(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function previousPeriod(from: string, to: string): { from: string; to: string } {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
  return {
    from: previousStart.toISOString().slice(0, 10),
    to: previousEnd.toISOString().slice(0, 10),
  };
}

function labelFor(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (v) => v.toUpperCase());
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return new Intl.NumberFormat('en-US').format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()))
      return date.toLocaleString('en-GB', { timeZone: 'Africa/Mogadishu' });
  }
  return String(value);
}

const PERIOD_FLOW_METRICS = new Set([
  'newProjects',
  'newTasks',
  'completedTasks',
  'newClients',
  'newInquiries',
  'newProjectRequests',
  'convertedProjectRequests',
]);

function validHref(href: unknown): href is string {
  return typeof href === 'string' && href.startsWith('/') && !href.startsWith('//');
}

function SummaryCards({ summary }: { summary: Record<string, string | number | null> }): ReactNode {
  const entries = Object.entries(summary);
  if (!entries.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted">{labelFor(key)}</p>
          <p className="mt-1 text-xl font-semibold text-ink">{display(value)}</p>
        </div>
      ))}
    </div>
  );
}

function Overview({ from, to }: { from: string; to: string }): ReactNode {
  const prior = useMemo(() => previousPeriod(from, to), [from, to]);
  const current = useQuery({
    queryKey: ['reports-overview', from, to],
    queryFn: () => reportsApi.overview(from, to),
  });
  const previous = useQuery({
    queryKey: ['reports-overview', prior.from, prior.to],
    queryFn: () => reportsApi.overview(prior.from, prior.to),
  });
  if (current.isLoading) return <LoadingState rows={4} />;
  if (current.isError)
    return (
      <ErrorState
        description="Executive metrics could not be loaded."
        onRetry={() => void current.refetch()}
      />
    );
  const overview = current.data;
  if (!overview) return <EmptyState title="No executive metrics available" />;
  const entries = Object.entries(overview.metrics).filter(
    ([, value]) => value !== null && !Array.isArray(value),
  );
  const finance = Array.isArray(overview.metrics.finance) ? overview.metrics.finance : [];
  return (
    <section aria-labelledby="reports-overview-title" className="space-y-4">
      <div>
        <h2 id="reports-overview-title" className="text-lg font-semibold text-ink">
          Executive overview
        </h2>
        <p className="text-sm text-muted">
          {from} to {to} · {overview.period.timezone} · Updated{' '}
          <time dateTime={overview.generatedAt}>
            {new Date(overview.generatedAt).toLocaleString()}
          </time>
        </p>
      </div>
      {entries.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {entries.map(([key, value]) => {
            const priorValue = previous.data?.metrics[key];
            const difference =
              PERIOD_FLOW_METRICS.has(key) &&
              typeof value === 'number' &&
              typeof priorValue === 'number'
                ? value - priorValue
                : null;
            return (
              <div key={key} className="rounded-lg border border-border bg-surface p-4">
                <h3 className="text-sm text-muted">{labelFor(key)}</h3>
                <p className="mt-1 text-2xl font-semibold text-ink">{display(value)}</p>
                {difference !== null ? (
                  <p className="mt-1 text-xs text-muted">
                    {difference > 0 ? '+' : ''}
                    {display(difference)} vs previous {prior.from} to {prior.to}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : !finance.length ? (
        <EmptyState title="No executive metrics available for your access" />
      ) : null}
      {finance.length ? (
        <div className="space-y-2">
          <h3 className="font-semibold text-ink">Finance by currency</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {finance.map((item) => (
              <div
                key={String(item.currency)}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <p className="font-medium text-ink">{display(item.currency)}</p>
                <dl className="mt-2 space-y-1 text-sm text-muted">
                  <div className="flex justify-between gap-3">
                    <dt>Revenue</dt>
                    <dd>{display(item.revenue)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Expenses</dt>
                    <dd>{display(item.expenses)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 font-semibold text-ink">
                    <dt>Net profit</dt>
                    <dd>{display(item.netProfit)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReportCell({ row, columnKey }: { row: ReportRow; columnKey: string }): ReactNode {
  const value = row[columnKey];
  if (columnKey === 'href' && validHref(value)) {
    return (
      <Link className="text-primary underline-offset-2 hover:underline" to={value}>
        Open record
      </Link>
    );
  }
  if (validHref(row.href) && ['name', 'title', 'engineer', 'companyName'].includes(columnKey)) {
    return (
      <Link className="font-medium text-primary underline-offset-2 hover:underline" to={row.href}>
        {display(value)}
      </Link>
    );
  }
  return display(value);
}

export function ReportsPage(): ReactNode {
  const [periodInput, setPeriodInput] = useState(defaultPeriod);
  const [period, setPeriod] = useState(defaultPeriod);
  const [category, setCategory] = useState('all');
  const [selectedKey, setSelectedKey] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [projectId, setProjectId] = useState('');
  const [clientId, setClientId] = useState('');
  const [engineerId, setEngineerId] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const catalog = useQuery({ queryKey: ['reports-catalog'], queryFn: reportsApi.catalog });
  const reports = catalog.data?.reports ?? [];
  const categories = [...new Set(reports.map((report) => report.category))];
  const visibleReports =
    category === 'all' ? reports : reports.filter((report) => report.category === category);
  const selected = visibleReports.find((report) => report.key === selectedKey) ?? visibleReports[0];
  const supportedFilters = new Set(selected?.filters ?? []);
  const filters = useMemo<ReportFilters>(
    () => ({
      ...period,
      page,
      pageSize: PAGE_SIZE,
      search: supportedFilters.has('search') ? search.trim() || undefined : undefined,
      status:
        supportedFilters.has('status') && selected?.statusOptions?.includes(status)
          ? status
          : undefined,
      projectId: supportedFilters.has('projectId') ? projectId.trim() || undefined : undefined,
      clientId: supportedFilters.has('clientId') ? clientId.trim() || undefined : undefined,
      engineerId: supportedFilters.has('engineerId') ? engineerId.trim() || undefined : undefined,
    }),
    [period, page, search, status, projectId, clientId, engineerId, selected],
  );
  const reportQuery = useQuery({
    queryKey: ['reports-result', selected?.key, filters],
    queryFn: () => reportsApi.report(selected!.key, filters),
    enabled: Boolean(selected),
  });

  function applyPeriod(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (periodInput.from > periodInput.to) {
      setError('The start date must be on or before the end date.');
      return;
    }
    setError('');
    setPage(1);
    setPeriod(periodInput);
  }

  async function exportCsv(): Promise<void> {
    if (!selected) return;
    setError('');
    setExporting(true);
    try {
      await reportsApi.csv(selected.key, filters);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'CSV export failed.');
    } finally {
      setExporting(false);
    }
  }

  if (catalog.isLoading) return <LoadingState rows={6} />;
  if (catalog.isError)
    return (
      <ErrorState
        description="Reports catalog could not be loaded."
        onRetry={() => void catalog.refetch()}
      />
    );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Reports &amp; Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          Live reports from records you are authorized to view.
        </p>
      </header>

      <form
        onSubmit={applyPeriod}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <Input
          label="From"
          type="date"
          required
          value={periodInput.from}
          onChange={(event) =>
            setPeriodInput((current) => ({ ...current, from: event.target.value }))
          }
        />
        <Input
          label="To"
          type="date"
          required
          value={periodInput.to}
          onChange={(event) =>
            setPeriodInput((current) => ({ ...current, to: event.target.value }))
          }
        />
        <Button type="submit">Apply period</Button>
      </form>
      {error ? (
        <p role="alert" className="rounded border border-error p-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      <Overview from={period.from} to={period.to} />

      <section aria-labelledby="report-builder-title" className="space-y-4">
        <div>
          <h2 id="report-builder-title" className="text-lg font-semibold text-ink">
            Report builder
          </h2>
          <p className="text-sm text-muted">
            Choose a report, refine its server-side filters, and open source records for detail.
          </p>
        </div>
        {reports.length ? (
          <>
            <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-3">
              <label className="text-sm font-medium text-ink">
                Category
                <select
                  className={fieldClass}
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setSelectedKey('');
                    setPage(1);
                  }}
                >
                  <option value="all">All categories</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {labelFor(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-ink md:col-span-2">
                Report
                <select
                  className={fieldClass}
                  value={selected?.key ?? ''}
                  onChange={(event) => {
                    setSelectedKey(event.target.value);
                    setPage(1);
                  }}
                >
                  {visibleReports.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {selected?.description ? (
                <p className="text-sm text-muted md:col-span-3">{selected.description}</p>
              ) : null}
              {selected?.key === 'receivables-aging' ? (
                <p className="text-sm text-muted md:col-span-3">
                  As of {period.to} in Africa/Mogadishu. The From date does not limit this
                  outstanding-balance snapshot. Amounts have no recorded currency; use the invoice
                  link to review each balance.
                </p>
              ) : null}
              {supportedFilters.has('search') ? (
                <Input
                  label="Search"
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              ) : null}
              {supportedFilters.has('status') ? (
                <label className="text-sm font-medium text-ink">
                  Status
                  <select
                    className={fieldClass}
                    value={selected?.statusOptions?.includes(status) ? status : ''}
                    onChange={(event) => {
                      setStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All statuses</option>
                    {selected?.statusOptions?.map((option) => (
                      <option key={option} value={option}>
                        {labelFor(option)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {supportedFilters.has('projectId') ? (
                <Input
                  label="Project ID"
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setPage(1);
                  }}
                />
              ) : null}
              {supportedFilters.has('clientId') ? (
                <Input
                  label="Client ID"
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value);
                    setPage(1);
                  }}
                />
              ) : null}
              {supportedFilters.has('engineerId') ? (
                <Input
                  label="Engineer ID"
                  value={engineerId}
                  onChange={(event) => {
                    setEngineerId(event.target.value);
                    setPage(1);
                  }}
                />
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                isLoading={exporting}
                onClick={() => void exportCsv()}
                disabled={!selected}
              >
                Export CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.print()}
                disabled={!reportQuery.data}
              >
                Print current page
              </Button>
            </div>
            {reportQuery.isLoading ? (
              <LoadingState rows={5} />
            ) : reportQuery.isError ? (
              <ErrorState
                description="The report could not be loaded."
                onRetry={() => void reportQuery.refetch()}
              />
            ) : reportQuery.data ? (
              <>
                <SummaryCards summary={reportQuery.data.data.summary} />
                <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="p-4 text-left font-semibold text-ink">
                      {selected?.label} · {reportQuery.data.meta.total} records
                    </caption>
                    <thead className="bg-surface-alt">
                      <tr>
                        {reportQuery.data.data.columns.map((column) => (
                          <th
                            key={column.key}
                            scope="col"
                            className="whitespace-nowrap px-4 py-3 font-semibold text-ink"
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportQuery.data.data.rows.map((row, index) => (
                        <tr key={String(row.id ?? index)} className="border-t border-border">
                          {reportQuery.data.data.columns.map((column) => (
                            <td key={column.key} className="px-4 py-3 text-ink">
                              <ReportCell row={row} columnKey={column.key} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!reportQuery.data.data.rows.length ? (
                    <EmptyState title="No records match these filters" />
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                  <p>
                    Page {reportQuery.data.meta.page} of{' '}
                    {Math.max(1, Math.ceil(reportQuery.data.meta.total / PAGE_SIZE))} ·{' '}
                    {selected?.key === 'receivables-aging'
                      ? `As of ${period.to}`
                      : `${period.from} to ${period.to}`}{' '}
                    ({reportQuery.data.data.period.timezone}) · Updated{' '}
                    <time dateTime={reportQuery.data.data.generatedAt}>
                      {new Date(reportQuery.data.data.generatedAt).toLocaleString()}
                    </time>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={page * PAGE_SIZE >= reportQuery.data.meta.total}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <EmptyState title="No reports available for your access" />
        )}
      </section>
    </section>
  );
}
