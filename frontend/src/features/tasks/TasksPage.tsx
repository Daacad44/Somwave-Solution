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

const PAGE_SIZE = 20;

const STATUS_TONE: Record<TaskStatus, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  IN_REVIEW: 'warning',
  DONE: 'success',
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

export function TasksPage(): ReactNode {
  const [page, setPage] = useState(1);
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');

  const canCreate = useHasPermission(PERMISSIONS.TASKS_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.TASKS_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.TASKS_DELETE);

  // Projects populate the filter and the create form's project picker.
  const projectsQuery = useProjects({ page: 1, pageSize: 100 });
  const projects = (projectsQuery.data?.data ?? []).map((p) => ({ id: p.id, name: p.name }));

  const query = useTasks({
    page,
    pageSize: PAGE_SIZE,
    projectId: projectId || undefined,
    status: status || undefined,
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
          <h1 className="text-2xl font-semibold text-ink">Hawlaha</h1>
          <p className="mt-1 text-base text-muted">Maamul hawlaha mashruucyada.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>Hawl cusub</Button> : null}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-2">
        <Select
          aria-label="Kala sooc mashruuca"
          options={[
            { value: '', label: 'Dhammaan mashruucyada' },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
          value={projectId}
          onChange={(e) => {
            setPage(1);
            setProjectId(e.target.value);
          }}
        />
        <Select
          aria-label="Kala sooc xaalada"
          options={[
            { value: '', label: 'Dhammaan xaaladaha' },
            ...TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] })),
          ]}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as TaskStatus | '');
          }}
        />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState description="Hawlaha lama soo rari karin." onRetry={() => query.refetch()} />
        ) : tasks.length === 0 ? (
          <EmptyState
            title="Weli hawl ma jirto"
            description={projectId || status ? 'Kala-soocdu waxba ma soo celin.' : undefined}
            action={canCreate ? <Button onClick={openCreate}>Hawl cusub</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cinwaan</Th>
                <Th>Mashruuc</Th>
                <Th>Xaalad</Th>
                <Th>Mudnaan</Th>
                <Th>Dhammaad</Th>
                <Th className="text-end">Ficil</Th>
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
                          Wax ka beddel
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(task)}>
                          Tirtir
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

      {total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Bogga {page} / {totalPages} · {total} hawl
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Hore
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Xiga
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

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Tirtir hawsha">
        <p className="text-base text-ink">
          Ma hubtaa inaad tirtirayso <strong>{confirming?.title}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Maya
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
            Haa, tirtir
          </Button>
        </div>
      </Modal>
    </section>
  );
}
