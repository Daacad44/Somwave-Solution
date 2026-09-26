import { type ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MILESTONE_STATUS_LABELS,
  PROJECT_HEALTH_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ProjectHealth,
  type ProjectWorkspace,
} from '@somwave/shared';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Table, TBody, Td, Th, THead, Tr } from '../../../components/ui/Table';
import { EmptyState } from '../../../components/states';
import { formatLongDate } from '../../../lib/date';
import { ProjectTimeline } from './ProjectTimeline';

const HEALTH_TONE: Record<ProjectHealth, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = {
  ON_TRACK: 'success',
  AT_RISK: 'warning',
  OVERDUE: 'error',
  COMPLETE: 'success',
  CANCELLED: 'neutral',
  NO_DATE: 'info',
};

export function ProjectWorkspaceView({
  data,
  backTo,
  backLabel,
}: {
  data: ProjectWorkspace;
  backTo: string;
  backLabel: string;
}): ReactNode {
  const [taskQuery, setTaskQuery] = useState('');
  const tasks = useMemo(() => {
    const needle = taskQuery.trim().toLowerCase();
    if (!needle) return data.tasks;
    return data.tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(needle) ||
        (task.assignee?.name.toLowerCase().includes(needle) ?? false),
    );
  }, [data.tasks, taskQuery]);

  return (
    <section className="flex min-w-0 flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link
          to={backTo}
          className="font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {backLabel}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-ink">{data.project.name}</span>
      </nav>

      <header className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">{data.project.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {data.project.clientName ?? 'Macmiil lama xirin'}
              {data.project.manager ? ` · ${data.project.manager.name}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">{PROJECT_STATUS_LABELS[data.project.status]}</Badge>
            <Badge tone={HEALTH_TONE[data.health]}>{PROJECT_HEALTH_LABELS[data.health]}</Badge>
          </div>
        </div>
        {data.project.description ? (
          <p className="mt-4 max-w-3xl text-sm text-ink">{data.project.description}</p>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">Billowga</dt>
            <dd className="font-medium text-ink">{formatLongDate(data.project.startDate)}</dd>
          </div>
          <div>
            <dt className="text-muted">Dhammaadka</dt>
            <dd className="font-medium text-ink">{formatLongDate(data.project.dueDate)}</dd>
          </div>
          <div>
            <dt className="text-muted">Miisaaniyad</dt>
            <dd className="font-medium text-ink">
              {data.project.budget ? `$${data.project.budget}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Hawlaha</dt>
            <dd className="font-medium text-ink">
              {data.taskCounts.done}/{data.taskCounts.total} la dhammeeyay
            </dd>
          </div>
        </dl>
        <div className="mt-4">
          {data.progress === null ? (
            <p className="text-sm text-muted">
              Horumar lama xisaabin. Ku dar hawl si boqolkiiba uu u muuqdo.
            </p>
          ) : (
            <>
              <div
                className="h-2 overflow-hidden rounded-full bg-canvas"
                role="progressbar"
                aria-valuenow={data.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Horumarka mashruuca"
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${data.progress}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                {data.progress}% ee hawlaha waa la dhammeeyay.
              </p>
            </>
          )}
        </div>
      </header>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">Jadwalka</h2>
        <p className="mt-1 text-sm text-muted">
          Hawlaha iyo marxaladaha leh taariikh dhab ah. Taariikh aan jirin lama qiyaaso.
        </p>
        <div className="mt-4">
          <ProjectTimeline project={data.project} tasks={data.tasks} milestones={data.milestones} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Hawlaha</h2>
            <p className="mt-1 text-sm text-muted">Hawlaha ku xiran mashruucan.</p>
          </div>
          <Input
            aria-label="Raadi hawlaha"
            placeholder="Raadi hawl…"
            value={taskQuery}
            onChange={(event) => setTaskQuery(event.target.value)}
            className="sm:w-64"
          />
        </div>
        <div className="mt-4">
          {tasks.length === 0 ? (
            <EmptyState
              title={taskQuery ? 'Raadintaadu waxba ma soo celin' : 'Hawl ma jirto'}
              description={
                taskQuery
                  ? 'Isku day magac kale.'
                  : 'Hawlaha laga sameeyo bogga Hawlaha ayaa halkan ka muuqan doona.'
              }
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Cinwaan</Th>
                  <Th>Xaalad</Th>
                  <Th>Mudnaan</Th>
                  <Th>Qofka</Th>
                  <Th>Dhammaad</Th>
                </Tr>
              </THead>
              <TBody>
                {tasks.map((task) => (
                  <Tr key={task.id}>
                    <Td className="font-medium">{task.title}</Td>
                    <Td>{TASK_STATUS_LABELS[task.status]}</Td>
                    <Td>{TASK_PRIORITY_LABELS[task.priority]}</Td>
                    <Td className="text-muted">{task.assignee?.name ?? '—'}</Td>
                    <Td className="text-muted">{formatLongDate(task.dueDate)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">Marxaladaha</h2>
        <div className="mt-4">
          {data.milestones.length === 0 ? (
            <EmptyState
              title="Marxalad ma jirto"
              description="Marxaladaha laga sameeyo bogga Marxaladaha ayaa halkan ka muuqan doona."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Cinwaan</Th>
                  <Th>Xaalad</Th>
                  <Th>Dhammaad</Th>
                </Tr>
              </THead>
              <TBody>
                {data.milestones.map((milestone) => (
                  <Tr key={milestone.id}>
                    <Td className="font-medium">{milestone.title}</Td>
                    <Td>{MILESTONE_STATUS_LABELS[milestone.status]}</Td>
                    <Td className="text-muted">{formatLongDate(milestone.dueDate)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </section>
    </section>
  );
}
