import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingState, ErrorState, EmptyState } from '../../components/states';
import { analyticsApi, type MonthlyCount } from './analyticsApi';

function Bars({ rows, label }: { rows: MonthlyCount[]; label: string }): ReactNode {
  const maximum = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div role="img" aria-label={label} className="grid grid-cols-6 items-end gap-2">
      {rows.map((row) => (
        <div key={row.month} className="flex flex-col items-center gap-2 text-center text-xs">
          <span className="font-semibold">{row.count}</span>
          <div className="flex h-28 w-full items-end rounded bg-surface-alt">
            <div
              className="w-full rounded bg-brand"
              style={{ height: `${Math.max(row.count ? 8 : 0, (row.count / maximum) * 100)}%` }}
            />
          </div>
          <span>{row.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function EngineeringAnalyticsPage(): ReactNode {
  const query = useQuery({ queryKey: ['engineering-analytics'], queryFn: analyticsApi.load });
  if (query.isLoading) return <LoadingState rows={6} />;
  if (query.isError)
    return (
      <ErrorState
        description="Could not load engineering analytics."
        onRetry={() => void query.refetch()}
      />
    );
  const data = query.data;
  if (!data) return <EmptyState title="No analytics available" />;
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Engineering analytics</h1>
        <p className="mt-1 text-sm text-muted">
          Live project, task, release, maintenance and SLA data for projects you can access.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold">Project progress</h2>
          {data.projectProgress.length ? (
            <div className="space-y-3">
              {data.projectProgress.map((row) => (
                <div key={row.projectId}>
                  <div className="flex justify-between text-sm">
                    <span>{row.name}</span>
                    <span>
                      {row.done}/{row.total} · {row.percent}%
                    </span>
                  </div>
                  <div className="mt-1 h-3 rounded bg-surface-alt">
                    <div className="h-full rounded bg-brand" style={{ width: `${row.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No projects" />
          )}
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold">Engineer workload</h2>
          {data.engineerWorkload.length ? (
            <div className="space-y-3">
              {data.engineerWorkload.map((row) => (
                <div key={row.userId}>
                  <div className="flex justify-between text-sm">
                    <span>{row.name}</span>
                    <span>
                      {row.activeTasks} tasks · {row.estimatedHours}/{row.weeklyCapacityHours} hours
                    </span>
                  </div>
                  <div className="mt-1 h-3 rounded bg-surface-alt">
                    <div
                      className="h-full rounded bg-brand"
                      style={{
                        width: `${Math.min(100, (row.estimatedHours / row.weeklyCapacityHours) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No active assignments" />
          )}
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold">Task completion · last six months</h2>
          <Bars rows={data.taskCompletion} label="Tasks completed each month" />
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold">Bug trends · last six months</h2>
          <Bars rows={data.bugTrends} label="Bugs reported each month" />
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold">Release frequency · last six months</h2>
          <Bars rows={data.releaseFrequency} label="Releases created each month" />
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold">Maintenance performance</h2>
          <Bars
            rows={data.maintenancePerformance.map((row) => ({
              month: row.month,
              count: row.completed,
            }))}
            label="Maintenance requests completed each month"
          />
          <p className="mt-3 text-sm text-muted">
            Completed on time:{' '}
            {data.maintenancePerformance.reduce((sum, row) => sum + row.onTime, 0)} /{' '}
            {data.maintenancePerformance.reduce((sum, row) => sum + row.completed, 0)}
          </p>
        </section>
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">SLA compliance</h2>
        <p className="mt-1 text-sm">
          {data.slaCompliance.total
            ? `${data.slaCompliance.onTime} of ${data.slaCompliance.total} resolved bugs and completed maintenance requests met their resolution target.`
            : 'No resolved bugs or completed maintenance requests yet.'}
        </p>
        <div className="mt-3 h-5 rounded bg-surface-alt">
          <div
            className="h-full rounded bg-success"
            style={{ width: `${data.slaCompliance.percent}%` }}
          />
        </div>
        <p className="mt-1 text-right text-sm font-semibold">{data.slaCompliance.percent}%</p>
      </section>
    </section>
  );
}
