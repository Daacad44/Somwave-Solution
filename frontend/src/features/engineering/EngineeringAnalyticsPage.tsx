import { type ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingState, ErrorState, EmptyState } from '../../components/states';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { analyticsApi, type MonthlyCount } from './analyticsApi';

const ROWS_PER_PAGE = 10;

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
  const [projectSearch, setProjectSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [projectPage, setProjectPage] = useState(1);
  const [engineerSearch, setEngineerSearch] = useState('');
  const [workloadFilter, setWorkloadFilter] = useState('ALL');
  const [engineerPage, setEngineerPage] = useState(1);
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
  const filteredProjects = data.projectProgress.filter((row) => {
    if (!row.name.toLocaleLowerCase().includes(projectSearch.trim().toLocaleLowerCase()))
      return false;
    if (projectFilter === 'COMPLETE') return row.total > 0 && row.done === row.total;
    if (projectFilter === 'IN_PROGRESS') return row.done > 0 && row.done < row.total;
    if (projectFilter === 'NOT_STARTED') return row.done === 0;
    return true;
  });
  const filteredEngineers = data.engineerWorkload.filter((row) => {
    if (!row.name.toLocaleLowerCase().includes(engineerSearch.trim().toLocaleLowerCase()))
      return false;
    if (workloadFilter === 'OVER_CAPACITY') return row.estimatedHours > row.weeklyCapacityHours;
    if (workloadFilter === 'AVAILABLE') return row.estimatedHours < row.weeklyCapacityHours;
    return true;
  });
  const projectPages = Math.max(1, Math.ceil(filteredProjects.length / ROWS_PER_PAGE));
  const engineerPages = Math.max(1, Math.ceil(filteredEngineers.length / ROWS_PER_PAGE));
  const currentProjectPage = Math.min(projectPage, projectPages);
  const currentEngineerPage = Math.min(engineerPage, engineerPages);
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
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              aria-label="Search project progress"
              placeholder="Search projects"
              value={projectSearch}
              onChange={(event) => {
                setProjectSearch(event.target.value);
                setProjectPage(1);
              }}
              className="min-w-40 flex-1"
            />
            <select
              aria-label="Filter project progress"
              className="rounded border border-border bg-surface p-2 text-sm"
              value={projectFilter}
              onChange={(event) => {
                setProjectFilter(event.target.value);
                setProjectPage(1);
              }}
            >
              <option value="ALL">All progress</option>
              <option value="NOT_STARTED">Not started</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETE">Complete</option>
            </select>
          </div>
          {filteredProjects.length ? (
            <div className="space-y-3">
              {filteredProjects
                .slice((currentProjectPage - 1) * ROWS_PER_PAGE, currentProjectPage * ROWS_PER_PAGE)
                .map((row) => (
                  <div key={row.projectId}>
                    <div className="flex justify-between text-sm">
                      <span>{row.name}</span>
                      <span>
                        {row.done}/{row.total} · {row.percent}%
                      </span>
                    </div>
                    <div className="mt-1 h-3 rounded bg-surface-alt">
                      <div
                        className="h-full rounded bg-brand"
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyState
              title={data.projectProgress.length ? 'No matching projects' : 'No projects'}
            />
          )}
          {filteredProjects.length > ROWS_PER_PAGE ? (
            <nav
              aria-label="Project progress pages"
              className="mt-4 flex items-center justify-between gap-2 text-xs text-muted"
            >
              <span>
                Page {currentProjectPage} of {projectPages} · {filteredProjects.length} projects
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentProjectPage <= 1}
                  onClick={() => setProjectPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentProjectPage >= projectPages}
                  onClick={() => setProjectPage((page) => Math.min(projectPages, page + 1))}
                >
                  Next
                </Button>
              </div>
            </nav>
          ) : null}
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold">Engineer workload</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              aria-label="Search engineer workload"
              placeholder="Search engineers"
              value={engineerSearch}
              onChange={(event) => {
                setEngineerSearch(event.target.value);
                setEngineerPage(1);
              }}
              className="min-w-40 flex-1"
            />
            <select
              aria-label="Filter engineer workload"
              className="rounded border border-border bg-surface p-2 text-sm"
              value={workloadFilter}
              onChange={(event) => {
                setWorkloadFilter(event.target.value);
                setEngineerPage(1);
              }}
            >
              <option value="ALL">All workloads</option>
              <option value="OVER_CAPACITY">Over capacity</option>
              <option value="AVAILABLE">Below capacity</option>
            </select>
          </div>
          {filteredEngineers.length ? (
            <div className="space-y-3">
              {filteredEngineers
                .slice(
                  (currentEngineerPage - 1) * ROWS_PER_PAGE,
                  currentEngineerPage * ROWS_PER_PAGE,
                )
                .map((row) => (
                  <div key={row.userId}>
                    <div className="flex justify-between text-sm">
                      <span>{row.name}</span>
                      <span>
                        {row.activeTasks} tasks · {row.estimatedHours}/{row.weeklyCapacityHours}{' '}
                        hours
                      </span>
                    </div>
                    <div className="mt-1 h-3 rounded bg-surface-alt">
                      <div
                        className="h-full rounded bg-brand"
                        style={{
                          width: `${row.weeklyCapacityHours > 0 ? Math.min(100, (row.estimatedHours / row.weeklyCapacityHours) * 100) : row.estimatedHours > 0 ? 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyState
              title={
                data.engineerWorkload.length ? 'No matching engineers' : 'No active assignments'
              }
            />
          )}
          {filteredEngineers.length > ROWS_PER_PAGE ? (
            <nav
              aria-label="Engineer workload pages"
              className="mt-4 flex items-center justify-between gap-2 text-xs text-muted"
            >
              <span>
                Page {currentEngineerPage} of {engineerPages} · {filteredEngineers.length} engineers
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentEngineerPage <= 1}
                  onClick={() => setEngineerPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentEngineerPage >= engineerPages}
                  onClick={() => setEngineerPage((page) => Math.min(engineerPages, page + 1))}
                >
                  Next
                </Button>
              </div>
            </nav>
          ) : null}
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
