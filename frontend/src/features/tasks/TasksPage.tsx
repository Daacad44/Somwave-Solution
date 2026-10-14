// Tasks management screen (I2.2). Table with project + status filters and
// pagination, the four states (§12), and permission-gated actions (§13).
import { type ReactNode, useState } from 'react';
import type { AdminTask, TaskStatus, TaskPriority } from '@somwave/shared';
import {
  PERMISSIONS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useProjects } from '../projects/hooks';
import { useTasks, useDeleteTask } from './hooks';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskKanban } from './TaskKanban';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<TaskStatus, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  BACKLOG: 'neutral',
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  BLOCKED: 'error',
  IN_REVIEW: 'warning',
  TESTING: 'info',
  DONE: 'success',
  CANCELLED: 'neutral',
};
const PRIORITY_TONE: Record<TaskPriority, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'error',
};

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}

export function TasksPage({
  projectId: fixedProjectId,
  projectName,
}: { projectId?: string; projectName?: string } = {}): ReactNode {
  const [page, setPage] = useState(1);
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [view, setView] = useState<'list' | 'kanban'>('list');

  const canCreate = useHasPermission(PERMISSIONS.TASKS_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.TASKS_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.TASKS_DELETE);

  // Projects populate the filter and the create form's project picker.
  const projectsQuery = useProjects({ page: 1, pageSize: 100 });
  const projects = fixedProjectId
    ? [{ id: fixedProjectId, name: projectName ?? 'Current project' }]
    : (projectsQuery.data?.data ?? []).map((p) => ({ id: p.id, name: p.name }));

  const query = useTasks({
    page: view === 'kanban' ? 1 : page,
    pageSize: view === 'kanban' ? 100 : PAGE_SIZE,
    projectId: fixedProjectId || projectId || undefined,
    status: view === 'kanban' ? undefined : status || undefined,
  });
  const del = useDeleteTask();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminTask | null>(null);
  const [confirming, setConfirming] = useState<AdminTask | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (task: AdminTask): void => {
    setEditing(task);
    setFormOpen(true);
  };

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tasks = query.data?.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Tasks</h1>
          <p className="mt-1 text-base text-muted">Manage project tasks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={view === 'list' ? 'primary' : 'secondary'}
            onClick={() => setView('list')}
          >
            List
          </Button>
          <Button
            variant={view === 'kanban' ? 'primary' : 'secondary'}
            onClick={() => setView('kanban')}
          >
            Kanban
          </Button>
          {canCreate ? <Button onClick={openCreate}>New task</Button> : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-2">
        {!fixedProjectId ? (
          <Select
            aria-label="Filter by project"
            options={[
              { value: '', label: 'All projects' },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={projectId}
            onChange={(e) => {
              setPage(1);
              setProjectId(e.target.value);
            }}
          />
        ) : null}
        {view === 'list' ? (
          <Select
            aria-label="Filter by status"
            options={[
              { value: '', label: 'All statuses' },
              ...TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] })),
            ]}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as TaskStatus | '');
            }}
          />
        ) : null}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Loading" />
        ) : query.isError ? (
          <ErrorState description="Could not load tasks." onRetry={() => query.refetch()} />
        ) : tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            description={projectId || status ? 'No results match your filters.' : undefined}
            action={canCreate ? <Button onClick={openCreate}>New task</Button> : undefined}
          />
        ) : view === 'kanban' ? (
          <div className="p-4">
            <TaskKanban tasks={tasks} canUpdate={canUpdate} />
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Title</Th>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th>Priority</Th>
                <Th>Due date</Th>
                <Th className="text-end">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {tasks.map((task) => (
                <Tr key={task.id}>
                  <Td className="font-medium">{task.title}</Td>
                  <Td className="text-muted">{task.project.name}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={PRIORITY_TONE[task.priority]}>
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </Badge>
                  </Td>
                  <Td className="text-muted">{formatDate(task.dueDate)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(task)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(task)}>
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {view === 'list' && total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} / {totalPages} · {total} task
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <TaskFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          projects={projects}
          task={editing}
        />
      ) : null}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Delete task">
        <p className="text-base text-ink">
          Are you sure you want to delete <strong>{confirming?.title}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={del.isPending}
            onClick={async () => {
              if (!confirming) return;
              await del.mutateAsync(confirming.id);
              setConfirming(null);
            }}
          >
            Yes, delete
          </Button>
        </div>
      </Modal>
    </section>
  );
}
