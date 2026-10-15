// Projects management screen (I2.1). Table with search + status filter +
// pagination, the four states (§12), and permission-gated actions (§13).
import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AdminProject, ProjectStatus } from '@somwave/shared';
import { PERMISSIONS, PROJECT_STATUSES, PROJECT_HEALTH, TASK_PRIORITIES } from '@somwave/shared';
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
import { useProjectPortfolio, useDeleteProject } from './hooks';
import { ProjectFormModal } from './components/ProjectFormModal';
import { ProjectEngineerAssignmentModal } from './components/ProjectEngineerAssignmentModal';

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
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const page = Math.max(1, Number(params.get('page')) || 1);
  const view = params.get('view') === 'cards' ? 'cards' : 'table';
  const updateParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page' && key !== 'view') next.delete('page');
    setParams(next);
  };
  const showAssignmentGroup = (assignment: 'unassigned' | 'pending' | 'active'): void => {
    setSearchInput('');
    setParams(new URLSearchParams({ assignment, ...(view === 'cards' ? { view } : {}) }));
  };

  const canCreate = useHasPermission(PERMISSIONS.PROJECTS_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.PROJECTS_UPDATE);
  const canAssign = useHasPermission(PERMISSIONS.ENGINEERING_MANAGE);
  const canDelete = useHasPermission(PERMISSIONS.PROJECTS_DELETE);
  const canReadFinance = useHasPermission(PERMISSIONS.INVOICES_READ);

  const query = useProjectPortfolio({
    page,
    pageSize: PAGE_SIZE,
    search: params.get('search') || undefined,
    status: params.get('status') || undefined,
    priority: params.get('priority') || undefined,
    managerId: params.get('managerId') || undefined,
    engineerId: params.get('engineerId') || undefined,
    assignment: (['unassigned', 'pending', 'active'].includes(params.get('assignment') ?? '')
      ? params.get('assignment')
      : undefined) as 'unassigned' | 'pending' | 'active' | undefined,
    clientId: params.get('clientId') || undefined,
    health: params.get('health') || undefined,
    dueFrom: params.get('dueFrom') || undefined,
    dueTo: params.get('dueTo') || undefined,
    createdFrom: params.get('createdFrom') || undefined,
    createdTo: params.get('createdTo') || undefined,
    sortBy: params.get('sortBy') || undefined,
    sortDirection: params.get('sortDirection') === 'asc' ? 'asc' : 'desc',
  });
  const del = useDeleteProject();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProject | null>(null);
  const [confirming, setConfirming] = useState<AdminProject | null>(null);
  const [assigning, setAssigning] = useState<{ id: string; name: string } | null>(null);

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
    updateParam('search', searchInput.trim());
  };

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const projects = query.data?.items ?? [];
  const summary = query.data?.summary;
  const options = query.data?.filters;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Projects</h1>
          <p className="mt-1 text-base text-muted">
            Portfolio health, assignments, deadlines, and delivery.
          </p>
        </div>
        {canCreate ? <Button onClick={openCreate}>New project</Button> : null}
      </div>

      {summary ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {(
            [
              ['Total projects', summary.totalProjects],
              ['Active', summary.activeProjects],
              ['Completed', summary.completedProjects],
              ['Planning', summary.planningProjects],
              ['Delayed', summary.delayedProjects],
              ['At risk', summary.atRiskProjects],
              ['Assigned engineers', summary.assignedEngineers],
              ['Unassigned projects', summary.unassignedProjects],
              ['Pending invitations', summary.projectsWithPendingInvitations ?? 0],
              ['Active teams', summary.projectsWithActiveTeams ?? 0],
              ['Overdue tasks', summary.overdueTasks],
              ['Upcoming deadlines', summary.upcomingDeadlines],
            ] as const
          ).map(([label, value]) => (
            <button
              key={label}
              type="button"
              disabled={
                !['Unassigned projects', 'Pending invitations', 'Active teams'].includes(label)
              }
              aria-pressed={
                (label === 'Unassigned projects' && params.get('assignment') === 'unassigned') ||
                (label === 'Pending invitations' && params.get('assignment') === 'pending') ||
                (label === 'Active teams' && params.get('assignment') === 'active')
              }
              onClick={() =>
                showAssignmentGroup(
                  label === 'Unassigned projects'
                    ? 'unassigned'
                    : label === 'Pending invitations'
                      ? 'pending'
                      : 'active',
                )
              }
              className="rounded-lg border border-border bg-surface p-4 text-start enabled:cursor-pointer enabled:hover:border-brand enabled:focus-visible:outline-none enabled:focus-visible:ring-2 enabled:focus-visible:ring-brand disabled:opacity-100 aria-pressed:border-brand"
            >
              <span className="text-sm text-muted">{label}</span>
              <span className="mt-1 block text-2xl font-semibold">{value}</span>
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={submitSearch} className="mt-6 flex flex-wrap items-end gap-2">
        <Input
          placeholder="Search project name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search projects"
          className="min-w-56 flex-1"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setSearchInput('');
            setParams(new URLSearchParams());
          }}
        >
          Clear filters
        </Button>
      </form>

      <div className="mt-4 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          id="assignment-filter"
          label="Assignment"
          value={params.get('assignment') ?? ''}
          onChange={(event) => updateParam('assignment', event.target.value)}
          options={[
            { value: '', label: 'All assignments' },
            { value: 'unassigned', label: 'No active engineer' },
            { value: 'pending', label: 'Pending invitation' },
            { value: 'active', label: 'Active team' },
          ]}
        />
        <Select
          label="Status"
          value={params.get('status') ?? ''}
          onChange={(event) => updateParam('status', event.target.value)}
          options={[
            { value: '', label: 'All statuses' },
            ...PROJECT_STATUSES.map((value) => ({ value, label: INTERNAL_PROJECT_STATUS[value] })),
          ]}
        />
        <Select
          label="Priority"
          value={params.get('priority') ?? ''}
          onChange={(event) => updateParam('priority', event.target.value)}
          options={[
            { value: '', label: 'All priorities' },
            ...TASK_PRIORITIES.map((value) => ({ value, label: value })),
          ]}
        />
        <Select
          label="Health"
          value={params.get('health') ?? ''}
          onChange={(event) => updateParam('health', event.target.value)}
          options={[
            { value: '', label: 'All health states' },
            ...PROJECT_HEALTH.map((value) => ({
              value,
              label: value === 'OVERDUE' ? 'Delayed' : value.replaceAll('_', ' '),
            })),
          ]}
        />
        <Select
          label="Project manager"
          value={params.get('managerId') ?? ''}
          onChange={(event) => updateParam('managerId', event.target.value)}
          options={[
            { value: '', label: 'All managers' },
            ...(options?.managers ?? []).map((person) => ({
              value: person.id,
              label: person.name,
            })),
          ]}
        />
        <Select
          label="Assigned engineer"
          value={params.get('engineerId') ?? ''}
          onChange={(event) => updateParam('engineerId', event.target.value)}
          options={[
            { value: '', label: 'All engineers' },
            ...(options?.engineers ?? []).map((person) => ({
              value: person.id,
              label: person.name,
            })),
          ]}
        />
        <Select
          label="Client"
          value={params.get('clientId') ?? ''}
          onChange={(event) => updateParam('clientId', event.target.value)}
          options={[
            { value: '', label: 'All clients' },
            ...(options?.clients ?? []).map((client) => ({ value: client.id, label: client.name })),
          ]}
        />
        <Input
          label="Deadline from"
          type="date"
          value={params.get('dueFrom') ?? ''}
          onChange={(event) => updateParam('dueFrom', event.target.value)}
        />
        <Input
          label="Deadline to"
          type="date"
          value={params.get('dueTo') ?? ''}
          onChange={(event) => updateParam('dueTo', event.target.value)}
        />
        <Input
          label="Created from"
          type="date"
          value={params.get('createdFrom') ?? ''}
          onChange={(event) => updateParam('createdFrom', event.target.value)}
        />
        <Input
          label="Created to"
          type="date"
          value={params.get('createdTo') ?? ''}
          onChange={(event) => updateParam('createdTo', event.target.value)}
        />
        <Select
          label="Sort by"
          value={params.get('sortBy') ?? 'createdAt'}
          onChange={(event) => updateParam('sortBy', event.target.value)}
          options={['createdAt', 'name', 'dueDate', 'priority', 'health', 'progress'].map(
            (value) => ({ value, label: value.replace(/([A-Z])/g, ' $1') }),
          )}
        />
        <Select
          label="Sort direction"
          value={params.get('sortDirection') ?? 'desc'}
          onChange={(event) => updateParam('sortDirection', event.target.value)}
          options={[
            { value: 'desc', label: 'Descending' },
            { value: 'asc', label: 'Ascending' },
          ]}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{total} matching projects</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === 'table' ? 'primary' : 'secondary'}
            onClick={() => updateParam('view', 'table')}
          >
            Table
          </Button>
          <Button
            size="sm"
            variant={view === 'cards' ? 'primary' : 'secondary'}
            onClick={() => updateParam('view', 'cards')}
          >
            Cards
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Loading" />
        ) : query.isError ? (
          <ErrorState description="Could not load projects." onRetry={() => query.refetch()} />
        ) : projects.length === 0 ? (
          <EmptyState
            title={
              params.get('assignment') === 'unassigned'
                ? 'All projects have active engineers'
                : 'No matching projects'
            }
            description="Adjust the filters or create a project."
            action={canCreate ? <Button onClick={openCreate}>New project</Button> : undefined}
          />
        ) : view === 'cards' ? (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <article key={project.id} className="rounded-lg border border-border bg-canvas p-4">
                <Link
                  to={`/projects/${project.id}`}
                  className="font-semibold text-brand hover:underline"
                >
                  {project.name}
                </Link>
                <p className="mt-2 text-sm text-muted">
                  {project.clientName || 'No client'} · {project.manager?.name || 'No manager'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={STATUS_TONE[project.status]}>
                    {INTERNAL_PROJECT_STATUS[project.status]}
                  </Badge>
                  <Badge
                    tone={
                      project.health === 'OVERDUE'
                        ? 'error'
                        : project.health === 'AT_RISK'
                          ? 'warning'
                          : 'info'
                    }
                  >
                    {project.health === 'OVERDUE' ? 'Delayed' : project.health.replaceAll('_', ' ')}
                  </Badge>
                </div>
                <p className="mt-3 text-sm">
                  {project.priority} priority · {project.assignedEngineers} engineers ·{' '}
                  {project.taskCount} tasks
                </p>
                <p className="mt-1 text-sm text-muted">
                  Assignment:{' '}
                  {(
                    project.assignmentStatus ??
                    (project.assignedEngineers ? 'ACTIVE' : 'UNASSIGNED')
                  ).toLowerCase()}
                  {project.pendingInvitations ? ` · ${project.pendingInvitations} pending` : ''}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Deadline: {formatDate(project.dueDate)} · {project.overdueTasks} overdue tasks
                </p>
                <p className="mt-3 text-sm">
                  Progress: {project.progress === null ? 'No tasks yet' : `${project.progress}%`}
                </p>
                <div className="mt-1 h-2 rounded bg-surface">
                  <div
                    className="h-2 rounded bg-brand"
                    style={{ width: `${project.progress ?? 0}%` }}
                  />
                </div>
                {canAssign && project.status !== 'COMPLETED' && project.status !== 'CANCELLED' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setAssigning(project)}
                  >
                    Assign engineer
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Priority</Th>
                <Th>Health</Th>
                <Th>Progress</Th>
                <Th>Engineers</Th>
                <Th>Assignment status</Th>
                <Th>Manager</Th>
                <Th>Client</Th>
                {canReadFinance ? <Th>Budget</Th> : null}
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
                  <Td>{project.priority}</Td>
                  <Td>
                    {project.health === 'OVERDUE' ? 'Delayed' : project.health.replaceAll('_', ' ')}
                  </Td>
                  <Td>{project.progress === null ? '—' : `${project.progress}%`}</Td>
                  <Td>{project.assignedEngineers}</Td>
                  <Td>
                    {(
                      project.assignmentStatus ??
                      (project.assignedEngineers ? 'ACTIVE' : 'UNASSIGNED')
                    ).toLowerCase()}
                    {project.pendingInvitations ? ` · ${project.pendingInvitations} pending` : ''}
                  </Td>
                  <Td className="text-muted">{project.manager?.name ?? '—'}</Td>
                  <Td>{project.clientName ?? '—'}</Td>
                  {canReadFinance ? <Td>{formatMoney(project.budget)}</Td> : null}
                  <Td className="text-muted">{formatDate(project.dueDate)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canAssign &&
                      project.status !== 'COMPLETED' &&
                      project.status !== 'CANCELLED' ? (
                        <Button size="sm" variant="secondary" onClick={() => setAssigning(project)}>
                          Assign engineer
                        </Button>
                      ) : null}
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
              onClick={() => updateParam('page', String(Math.max(1, page - 1)))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => updateParam('page', String(Math.min(totalPages, page + 1)))}
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
      {assigning ? (
        <ProjectEngineerAssignmentModal project={assigning} onClose={() => setAssigning(null)} />
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
