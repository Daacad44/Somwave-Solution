import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { apiFetch } from '../../lib/apiClient';

interface EngineerOverview {
  tasks: Array<{
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    status: string;
    dueDate: string | null;
    estimatedHours: number | string | null;
    progressPercent: number;
  }>;
  reports: Array<{
    id: string;
    projectId: string;
    projectName: string;
    period: string;
    periodStart: string;
    status: string;
    blockers: string | null;
    completedWork: string;
  }>;
  timeEntries: Array<{
    id: string;
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    minutes: number;
    date: string;
  }>;
  maintenance: Array<{
    id: string;
    projectId: string;
    projectName: string;
    systemName: string;
    title: string;
    status: string;
    scheduledAt: string | null;
  }>;
  summary: {
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    openEstimateHours: number;
    trackedMinutes: number;
    blockerReports: number;
  };
}

export function EngineerOperationalOverview({
  engineerId,
  weeklyCapacityHours,
}: {
  engineerId: string;
  weeklyCapacityHours: number;
}): ReactNode {
  const overview = useQuery({
    queryKey: ['engineer-operational-overview', engineerId],
    queryFn: () => apiFetch<EngineerOverview>(`/engineering/engineers/${engineerId}/overview`),
    enabled: Boolean(engineerId),
  });
  if (overview.isLoading) return <LoadingState rows={5} />;
  if (overview.isError)
    return (
      <ErrorState
        description="Could not load engineer operational records."
        onRetry={() => void overview.refetch()}
      />
    );
  if (!overview.data) return <EmptyState title="No operational records" />;
  const data = overview.data;
  const active = data.tasks.filter((task) => !['DONE', 'CANCELLED'].includes(task.status));
  const completed = data.tasks.filter((task) => task.status === 'DONE');
  const due = active
    .filter((task) => task.dueDate)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .slice(0, 8);
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Workload and performance context</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Active tasks', data.summary.activeTasks],
            ['Completed tasks', data.summary.completedTasks],
            ['Overdue tasks', data.summary.overdueTasks],
            ['Open estimates', `${Number(data.summary.openEstimateHours).toFixed(1)} h`],
            ['Recorded time', `${(data.summary.trackedMinutes / 60).toFixed(1)} h`],
            ['Weekly capacity', `${weeklyCapacityHours} h`],
            ['Reports with blockers', data.summary.blockerReports],
          ].map(([name, value]) => (
            <div key={name} className="rounded bg-surface-alt p-3">
              <p className="text-sm text-muted">{name}</p>
              <p className="text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Task complexity, dependencies and approved leave provide context for these operational
          metrics.
        </p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Active tasks</h2>
          {active.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {active.slice(0, 20).map((task) => (
                <li
                  key={task.id}
                  className="flex justify-between gap-2 border-b border-border py-2"
                >
                  <span>
                    <strong>{task.title}</strong>
                    <span className="block text-muted">
                      {task.projectName} · {task.status.replaceAll('_', ' ')} ·{' '}
                      {task.progressPercent}%
                    </span>
                  </span>
                  <span className="text-muted">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No active tasks" />
          )}
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Completed tasks</h2>
          {completed.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {completed.slice(0, 20).map((task) => (
                <li key={task.id} className="border-b border-border py-2">
                  <strong>{task.title}</strong>
                  <span className="block text-muted">{task.projectName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No completed tasks" />
          )}
        </section>
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Upcoming workload calendar</h2>
        {due.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {due.map((task) => (
              <li key={task.id} className="rounded bg-surface-alt p-3 text-sm">
                <time className="font-semibold">
                  {new Date(task.dueDate!).toLocaleDateString()}
                </time>
                <span className="mt-1 block">{task.title}</span>
                <span className="text-muted">{task.projectName}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No scheduled task deadlines" />
        )}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Progress reports</h2>
          {data.reports.length ? (
            <ol className="mt-3 space-y-2 text-sm">
              {data.reports.slice(0, 20).map((report) => (
                <li key={report.id} className="rounded border border-border p-3">
                  <strong>
                    {report.period === 'WEEKLY' ? 'Weekly' : 'Daily'} ·{' '}
                    {new Date(report.periodStart).toLocaleDateString()} · {report.projectName}
                  </strong>
                  <p className="mt-1 whitespace-pre-wrap">{report.completedWork}</p>
                  {report.blockers ? (
                    <p className="mt-1 text-warning">Blockers: {report.blockers}</p>
                  ) : null}
                  <p className="mt-1 text-muted">{report.status.replaceAll('_', ' ')}</p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No progress reports" />
          )}
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Time tracking</h2>
          {data.timeEntries.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {data.timeEntries.slice(0, 30).map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-border py-2"
                >
                  <span>
                    {entry.taskTitle}
                    <span className="block text-muted">
                      {entry.projectName} · {new Date(entry.date).toLocaleDateString()}
                    </span>
                  </span>
                  <span>{(entry.minutes / 60).toFixed(1)} h</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No time entries" />
          )}
        </section>
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Maintenance responsibilities</h2>
        {data.maintenance.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {data.maintenance.slice(0, 30).map((item) => (
              <li key={item.id} className="rounded border border-border p-3">
                <strong>{item.title}</strong>
                <p className="text-muted">
                  {item.projectName} · {item.systemName} · {item.status.replaceAll('_', ' ')}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No maintenance assignments" />
        )}
      </section>
      <p className="text-sm text-muted">
        Open{' '}
        <Link to="/engineering/planning" className="text-brand hover:underline">
          Task Planning
        </Link>{' '}
        for task reviews and time corrections, or{' '}
        <Link to="/engineering/operations" className="text-brand hover:underline">
          Engineering Operations
        </Link>{' '}
        for complete maintenance history.
      </p>
    </div>
  );
}
