// Projects management screen (I2.1). Table with search + status filter +
// pagination, the four states (§12), and permission-gated actions (§13).
import { type FormEvent, type ReactNode, useState } from 'react';
import type { AdminProject, ProjectStatus } from '@somwave/shared';
import { PERMISSIONS, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
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

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}
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
          <h1 className="text-2xl font-semibold text-ink">Mashruucyada</h1>
          <p className="mt-1 text-base text-muted">Maamul mashruucyada shirkadda.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>Mashruuc cusub</Button> : null}
      </div>

      <form onSubmit={submitSearch} className="mt-6 flex flex-wrap items-end gap-2">
        <Input
          placeholder="Raadi magaca mashruuca…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Raadi mashruucyada"
          className="min-w-56 flex-1"
        />
        <Select
          aria-label="Kala sooc xaalada"
          options={[
            { value: '', label: 'Dhammaan xaaladaha' },
            ...PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] })),
          ]}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as ProjectStatus | '');
          }}
        />
        <Button type="submit" variant="secondary">
          Raadi
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Mashruucyada lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : projects.length === 0 ? (
          <EmptyState
            title="Weli mashruuc ma jiro"
            description={search || status ? 'Raadintaadu waxba ma soo celin.' : undefined}
            action={canCreate ? <Button onClick={openCreate}>Mashruuc cusub</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Magaca</Th>
                <Th>Xaalad</Th>
                <Th>Maareeye</Th>
                <Th>Miisaaniyad</Th>
                <Th>Dhammaad</Th>
                <Th className="text-end">Ficil</Th>
              </Tr>
            </THead>
            <TBody>
              {projects.map((project) => (
                <Tr key={project.id}>
                  <Td className="font-medium">{project.name}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[project.status]}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                  </Td>
                  <Td className="text-muted">{project.manager?.name ?? '—'}</Td>
                  <Td>{formatMoney(project.budget)}</Td>
                  <Td className="text-muted">{formatDate(project.dueDate)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(project)}>
                          Wax ka beddel
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(project)}>
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
            Bogga {page} / {totalPages} · {total} mashruuc
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
        <ProjectFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          project={editing}
        />
      ) : null}

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Tirtir mashruuca"
      >
        <p className="text-base text-ink">
          Ma hubtaa inaad tirtirayso <strong>{confirming?.name}</strong>?
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
