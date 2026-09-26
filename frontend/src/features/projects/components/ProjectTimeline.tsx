import { type ReactNode } from 'react';
import type { AdminMilestone, AdminTask } from '@somwave/shared';
import { EmptyState } from '../../../components/states';
import { formatLongDate } from '../../../lib/date';

type Mark = {
  id: string;
  label: string;
  kind: 'project' | 'task' | 'milestone';
  start: number;
  end: number;
};

const KIND_LABEL: Record<Mark['kind'], string> = {
  project: 'Mashruuc',
  task: 'Hawl',
  milestone: 'Marxalad',
};

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function ProjectTimeline({
  project,
  tasks,
  milestones,
}: {
  project: { name: string; startDate: string | null; dueDate: string | null };
  tasks: readonly AdminTask[];
  milestones: readonly AdminMilestone[];
}): ReactNode {
  const marks: Mark[] = [];
  const projectStart = parseTime(project.startDate);
  const projectEnd = parseTime(project.dueDate);
  if (projectStart !== null || projectEnd !== null) {
    const start = projectStart ?? projectEnd!;
    const end = projectEnd ?? projectStart!;
    marks.push({
      id: 'project',
      label: project.name,
      kind: 'project',
      start: Math.min(start, end),
      end: Math.max(start, end),
    });
  }
  for (const task of tasks) {
    const end = parseTime(task.dueDate);
    if (end === null) continue;
    const created = parseTime(task.createdAt);
    const start = created === null || created > end ? end : created;
    marks.push({ id: task.id, label: task.title, kind: 'task', start, end });
  }
  for (const milestone of milestones) {
    const at = parseTime(milestone.dueDate);
    if (at === null) continue;
    marks.push({ id: milestone.id, label: milestone.title, kind: 'milestone', start: at, end: at });
  }

  const unscheduled = tasks.filter((task) => parseTime(task.dueDate) === null);

  if (marks.length === 0) {
    return (
      <EmptyState
        title="Jadwal ma jiro"
        description="Ku dar taariikh billow ama dhammaad mashruuca, hawlaha, ama marxaladaha si ay halkan uga muuqdaan."
      />
    );
  }

  const min = Math.min(...marks.map((mark) => mark.start));
  const max = Math.max(...marks.map((mark) => mark.end));
  const span = Math.max(max - min, 24 * 60 * 60 * 1000);

  return (
    <div>
      <div className="overflow-x-auto">
        <ol className="min-w-[36rem] space-y-3">
          {marks.map((mark) => {
            const left = ((mark.start - min) / span) * 100;
            const width =
              mark.kind === 'milestone' ? 0 : Math.max(((mark.end - mark.start) / span) * 100, 1.5);
            return (
              <li
                key={`${mark.kind}-${mark.id}`}
                className="grid grid-cols-[9rem_1fr] items-center gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{mark.label}</p>
                  <p className="text-xs text-muted">
                    {KIND_LABEL[mark.kind]} · {formatLongDate(new Date(mark.end).toISOString())}
                  </p>
                </div>
                <div className="relative h-8 rounded-md bg-canvas">
                  {mark.kind === 'milestone' ? (
                    <span
                      className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 rounded-sm bg-brand"
                      style={{ left: `${left}%` }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-brand"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {unscheduled.length > 0 ? (
        <p className="mt-4 text-sm text-muted">
          {unscheduled.length} hawlood oo aan lahayn taariikh dhammaad ah kuma jiraan jadwalka.
        </p>
      ) : null}
    </div>
  );
}
