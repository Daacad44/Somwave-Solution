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

const ENGLISH_PROJECT_STATUS = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
const ENGLISH_HEALTH = {
  ON_TRACK: 'On track',
  AT_RISK: 'At risk',
  OVERDUE: 'Overdue',
  COMPLETE: 'Complete',
  CANCELLED: 'Cancelled',
  NO_DATE: 'No date',
};
const ENGLISH_MILESTONE_STATUS = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

export function ProjectWorkspaceView({
  data,
  backTo,
  backLabel,
  language = 'en',
}: {
  data: ProjectWorkspace;
  backTo: string;
  backLabel: string;
  language?: 'en' | 'so';
}): ReactNode {
  const t = (english: string, somali: string): string => (language === 'so' ? somali : english);
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
              {data.project.clientName ?? t('No client linked', 'Macmiil lama xirin')}
              {data.project.manager ? ` · ${data.project.manager.name}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">
              {language === 'so'
                ? PROJECT_STATUS_LABELS[data.project.status]
                : ENGLISH_PROJECT_STATUS[data.project.status]}
            </Badge>
            <Badge tone={HEALTH_TONE[data.health]}>
              {language === 'so' ? PROJECT_HEALTH_LABELS[data.health] : ENGLISH_HEALTH[data.health]}
            </Badge>
          </div>
        </div>
        {data.project.description ? (
          <p className="mt-4 max-w-3xl text-sm text-ink">{data.project.description}</p>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">{t('Start', 'Billowga')}</dt>
            <dd className="font-medium text-ink">{formatLongDate(data.project.startDate)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('Due', 'Dhammaadka')}</dt>
            <dd className="font-medium text-ink">{formatLongDate(data.project.dueDate)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('Budget', 'Miisaaniyad')}</dt>
            <dd className="font-medium text-ink">
              {data.project.budget ? `$${data.project.budget}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t('Tasks', 'Hawlaha')}</dt>
            <dd className="font-medium text-ink">
              {data.taskCounts.done}/{data.taskCounts.total} {t('completed', 'la dhammeeyay')}
            </dd>
          </div>
        </dl>
        <div className="mt-4">
          {data.progress === null ? (
            <p className="text-sm text-muted">
              {t(
                'No progress yet. Add a task to track completion.',
                'Horumar lama xisaabin. Ku dar hawl si boqolkiiba uu u muuqdo.',
              )}
            </p>
          ) : (
            <>
              <div
                className="h-2 overflow-hidden rounded-full bg-canvas"
                role="progressbar"
                aria-valuenow={data.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('Project progress', 'Horumarka mashruuca')}
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${data.progress}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                {t(
                  `${data.progress}% of tasks completed.`,
                  `${data.progress}% ee hawlaha waa la dhammeeyay.`,
                )}
              </p>
            </>
          )}
        </div>
      </header>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">{t('Timeline', 'Jadwalka')}</h2>
        <p className="mt-1 text-sm text-muted">
          {t(
            'Tasks and milestones with recorded dates. Missing dates are not estimated.',
            'Hawlaha iyo marxaladaha leh taariikh dhab ah. Taariikh aan jirin lama qiyaaso.',
          )}
        </p>
        <div className="mt-4">
          <ProjectTimeline
            project={data.project}
            tasks={data.tasks}
            milestones={data.milestones}
            language={language}
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t('Tasks', 'Hawlaha')}</h2>
            <p className="mt-1 text-sm text-muted">
              {t('Tasks in this project.', 'Hawlaha ku xiran mashruucan.')}
            </p>
          </div>
          <Input
            aria-label={t('Search tasks', 'Raadi hawlaha')}
            placeholder={t('Search tasks…', 'Raadi hawl…')}
            value={taskQuery}
            onChange={(event) => setTaskQuery(event.target.value)}
            className="sm:w-64"
          />
        </div>
        <div className="mt-4">
          {tasks.length === 0 ? (
            <EmptyState
              title={
                taskQuery
                  ? t('No matching tasks', 'Raadintaadu waxba ma soo celin')
                  : t('No tasks yet', 'Hawl ma jirto')
              }
              description={
                taskQuery
                  ? t('Try another search.', 'Isku day magac kale.')
                  : t(
                      'Tasks created on the Tasks page will appear here.',
                      'Hawlaha laga sameeyo bogga Hawlaha ayaa halkan ka muuqan doona.',
                    )
              }
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>{t('Title', 'Cinwaan')}</Th>
                  <Th>{t('Status', 'Xaalad')}</Th>
                  <Th>{t('Priority', 'Mudnaan')}</Th>
                  <Th>{t('Assignee', 'Qofka')}</Th>
                  <Th>{t('Due', 'Dhammaad')}</Th>
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
        <h2 className="text-base font-semibold text-ink">{t('Milestones', 'Marxaladaha')}</h2>
        <div className="mt-4">
          {data.milestones.length === 0 ? (
            <EmptyState
              title={t('No milestones yet', 'Marxalad ma jirto')}
              description={t(
                'Milestones created on the Milestones page will appear here.',
                'Marxaladaha laga sameeyo bogga Marxaladaha ayaa halkan ka muuqan doona.',
              )}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>{t('Title', 'Cinwaan')}</Th>
                  <Th>{t('Status', 'Xaalad')}</Th>
                  <Th>{t('Due', 'Dhammaad')}</Th>
                </Tr>
              </THead>
              <TBody>
                {data.milestones.map((milestone) => (
                  <Tr key={milestone.id}>
                    <Td className="font-medium">{milestone.title}</Td>
                    <Td>
                      {language === 'so'
                        ? MILESTONE_STATUS_LABELS[milestone.status]
                        : ENGLISH_MILESTONE_STATUS[milestone.status]}
                    </Td>
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
