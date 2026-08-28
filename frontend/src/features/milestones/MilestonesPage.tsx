// Milestones management screen (I2.3). Table with project + status filters and
// pagination, the four states (§12), and permission-gated actions (§13).
import { type ReactNode, useState } from 'react';
import type { AdminMilestone, MilestoneStatus } from '@somwave/shared';
import { PERMISSIONS, MILESTONE_STATUSES, MILESTONE_STATUS_LABELS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useProjects } from '../projects/hooks';
import { useMilestones, useDeleteMilestone } from './hooks';
import { MilestoneFormModal } from './components/MilestoneFormModal';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<MilestoneStatus, 'neutral' | 'info' | 'success'> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
};

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}

export function MilestonesPage(): ReactNode {
  const [page, setPage] = useState(1);
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<MilestoneStatus | ''>('');

  const canCreate = useHasPermission(PERMISSIONS.MILESTONES_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.MILESTONES_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.MILESTONES_DELETE);

  const projectsQuery = useProjects({ page: 1, pageSize: 100 });
  const projects = (projectsQuery.data?.data ?? []).map((p) => ({ id: p.id, name: p.name }));

  const query = useMilestones({
    page,
    pageSize: PAGE_SIZE,
    projectId: projectId || undefined,
    status: status || undefined,
  });
  const del = useDeleteMilestone();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminMilestone | null>(null);
  const [confirming, setConfirming] = useState<AdminMilestone | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (milestone: AdminMilestone): void => {
    setEditing(milestone);
    setFormOpen(true);
  };

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const milestones = query.data?.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Marxaladaha</h1>
          <p className="mt-1 text-base text-muted">Maamul marxaladaha mashruucyada.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>Marxalad cusub</Button> : null}
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
            ...MILESTONE_STATUSES.map((s) => ({ value: s, label: MILESTONE_STATUS_LABELS[s] })),
          ]}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as MilestoneStatus | '');
          }}
        />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Marxaladaha lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : milestones.length === 0 ? (
          <EmptyState
            title="Weli marxalad ma jirto"
            description={projectId || status ? 'Kala-soocdu waxba ma soo celin.' : undefined}
            action={canCreate ? <Button onClick={openCreate}>Marxalad cusub</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cinwaan</Th>
                <Th>Mashruuc</Th>
                <Th>Xaalad</Th>
                <Th>Dhammaad</Th>
                <Th className="text-end">Ficil</Th>
              </Tr>
            </THead>
            <TBody>
              {milestones.map((milestone) => (
                <Tr key={milestone.id}>
                  <Td className="font-medium">{milestone.title}</Td>
                  <Td className="text-muted">{milestone.project.name}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[milestone.status]}>
                      {MILESTONE_STATUS_LABELS[milestone.status]}
                    </Badge>
                  </Td>
                  <Td className="text-muted">{formatDate(milestone.dueDate)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(milestone)}>
                          Wax ka beddel
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(milestone)}>
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
            Bogga {page} / {totalPages} · {total} marxalad
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
        <MilestoneFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          projects={projects}
          milestone={editing}
        />
      ) : null}

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Tirtir marxaladda"
      >
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
