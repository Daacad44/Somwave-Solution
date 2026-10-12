// Projects management screen (I2.1). Table with search + status filter +
// pagination, the four states (§12), and permission-gated actions (§13).
import { type FormEvent, type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminProject, ProjectStatus } from '@somwave/shared';
import { PERMISSIONS, PROJECT_STATUSES } from '@somwave/shared';
import { INTERNAL_PROJECT_STATUS } from '../../lib/internalLabels';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { useProjects, useDeleteProject } from './hooks';
import { ProjectFormModal } from './components/ProjectFormModal';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<ProjectStatus, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  PLANNING: 'neutral',
  ACTIVE: 'info',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

function formatMoney(value: string | null): string {
  return value ? `$${value}` : '—';
}

export function ProjectsPage(): ReactNode {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');

  const canCreate = useHasPermission(PERMISSIONS.PROJECTS_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.PROJECTS_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.PROJECTS_DELETE);

  const query = useProjects({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    status: status || undefined,
  });
  const del = useDeleteProject();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProject | null>(null);
  const [confirming, setConfirming] = useState<AdminProject | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (project: AdminProject): void => {
    setEditing(project);
    setFormOpen(true);
  };

  const submitSearch = (e: FormEvent): void => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const projects = query.data?.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Projects</h1>
          <p className="mt-1 text-base text-muted">Manage company projects.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>New project</Button> : null}
      </div>

      <form onSubmit={submitSearch} className="mt-6 flex flex-wrap items-end gap-2">
        <Input
          placeholder="Search project name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search projects"
          className="min-w-56 flex-1"
        />
        <Select
          aria-label="Filter by status"
          options={[
            { value: '', label: 'All statuses' },
            ...PROJECT_STATUSES.map((s) => ({ value: s, label: INTERNAL_PROJECT_STATUS[s] })),
          ]}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as ProjectStatus | '');
          }}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Loading" />
        ) : query.isError ? (
          <ErrorState description="Could not load projects." onRetry={() => query.refetch()} />
        ) : projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description={
              search || status
                ? 'No results match your search.'
                : 'Create your first project to track work, milestones, and tasks.'
            }
            action={canCreate ? <Button onClick={openCreate}>New project</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Manager</Th>
                <Th>Budget</Th>
                <Th>Due date</Th>
                <Th className="text-end">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {projects.map((project) => (
                <Tr key={project.id}>
                  <Td>
                    <Link
                      to={`/projects/${project.id}`}
                      className="font-medium text-ink hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {project.name}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[project.status]}>
                      {INTERNAL_PROJECT_STATUS[project.status]}
                    </Badge>
                  </Td>
                  <Td className="text-muted">{project.manager?.name ?? '—'}</Td>
                  <Td>{formatMoney(project.budget)}</Td>
                  <Td className="text-muted">{formatDate(project.dueDate)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(project)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(project)}>
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

      {total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} / {totalPages} · {total} project
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
        <ProjectFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          project={editing}
        />
      ) : null}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Delete project">
        <p className="text-base text-ink">
          Are you sure you want to delete <strong>{confirming?.name}</strong>?
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
