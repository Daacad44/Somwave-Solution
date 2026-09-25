import { type DragEvent, type ReactNode, useState } from 'react';
import type { AdminTask, TaskStatus } from '@somwave/shared';
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@somwave/shared';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { useUpdateTask } from './hooks';

const STATUS_TONE: Record<TaskStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  IN_REVIEW: 'warning',
  DONE: 'success',
};

export function TaskKanban({
  tasks,
  canUpdate,
}: {
  tasks: AdminTask[];
  canUpdate: boolean;
}): ReactNode {
  const update = useUpdateTask();
  const [dragging, setDragging] = useState<string | null>(null);

  const move = (id: string, status: TaskStatus): void => {
    if (!canUpdate) return;
    void update.mutateAsync({ id, input: { status } });
  };

  const onDrop =
    (status: TaskStatus) =>
    (event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      const id = event.dataTransfer.getData('text/plain') || dragging;
      if (id) move(id, status);
      setDragging(null);
    };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const column = tasks.filter((task) => task.status === status);
        return (
          <div
            key={status}
            className="rounded-lg border border-border bg-surface p-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop(status)}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">{TASK_STATUS_LABELS[status]}</h2>
              <Badge tone={STATUS_TONE[status]}>{column.length}</Badge>
            </div>
            <ul className="flex flex-col gap-2">
              {column.map((task) => (
                <li
                  key={task.id}
                  draggable={canUpdate}
                  onDragStart={(event) => {
                    setDragging(task.id);
                    event.dataTransfer.setData('text/plain', task.id);
                  }}
                  className="rounded-md border border-border bg-surface-alt p-3"
                >
                  <p className="font-medium text-ink">{task.title}</p>
                  <p className="mt-1 text-sm text-muted">{task.project.name}</p>
                  <p className="mt-1 text-sm text-muted">{TASK_PRIORITY_LABELS[task.priority]}</p>
                  {canUpdate ? (
                    <div className="mt-3 xl:hidden">
                      <Select
                        aria-label={`U wareeji ${task.title}`}
                        options={TASK_STATUSES.map((value) => ({
                          value,
                          label: TASK_STATUS_LABELS[value],
                        }))}
                        value={task.status}
                        onChange={(e) => move(task.id, e.target.value as TaskStatus)}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
