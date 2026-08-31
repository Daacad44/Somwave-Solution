// CMS — careers / job openings management (W4.4, §9). EDITOR-facing screen; the
// four states (§12) and permission-gated actions (§13). An opening with
// applications can't be deleted — unpublish it instead (matches the server).
import { type ReactNode, useState } from 'react';
import type { AdminJobOpening } from '@somwave/shared';
import { PERMISSIONS, EMPLOYMENT_TYPE_LABELS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { ApiError } from '../../lib/apiClient';
import { useHasPermission } from '../../lib/rbac';
import { useCmsCareers, useDeleteOpening } from './hooks';
import { JobOpeningFormModal } from './components/JobOpeningFormModal';

export function CareersAdminPage(): ReactNode {
  const query = useCmsCareers();
  const del = useDeleteOpening();

  const canCreate = useHasPermission(PERMISSIONS.CONTENT_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.CONTENT_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.CONTENT_DELETE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminJobOpening | null>(null);
  const [confirming, setConfirming] = useState<AdminJobOpening | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (opening: AdminJobOpening): void => {
    setEditing(opening);
    setFormOpen(true);
  };

  const openings = query.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Fursadaha shaqo (CMS)</h1>
          <p className="mt-1 text-base text-muted">Maamul fursadaha shaqo ee websaydka.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>Fursad cusub</Button> : null}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={5} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Fursadaha lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : openings.length === 0 ? (
          <EmptyState
            title="Weli fursad ma jirto"
            action={canCreate ? <Button onClick={openCreate}>Fursad cusub</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cinwaan</Th>
                <Th>Nooc</Th>
                <Th>Codsiyo</Th>
                <Th>Xaalad</Th>
                <Th className="text-end">Ficil</Th>
              </Tr>
            </THead>
            <TBody>
              {openings.map((opening) => (
                <Tr key={opening.id}>
                  <Td className="font-medium">{opening.title}</Td>
                  <Td className="text-muted">{EMPLOYMENT_TYPE_LABELS[opening.employmentType]}</Td>
                  <Td>{opening.applicationCount}</Td>
                  <Td>
                    <Badge tone={opening.isPublished ? 'success' : 'neutral'}>
                      {opening.isPublished ? 'La daabacay' : 'Qabyo'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(opening)}>
                          Wax ka beddel
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setDeleteError(null);
                            setConfirming(opening);
                          }}
                        >
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

      {formOpen ? (
        <JobOpeningFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          opening={editing}
        />
      ) : null}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Tirtir fursadda">
        <p className="text-base text-ink">
          Ma hubtaa inaad tirtirayso <strong>{confirming?.title}</strong>?
          {confirming && confirming.applicationCount > 0
            ? ' Fursaddan waxay leedahay codsiyo — halkii, ka saar daabacaadda.'
            : ' Tallaabadan lama soo celin karo.'}
        </p>
        {deleteError ? <p className="mt-3 text-sm text-error">{deleteError}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Maya
          </Button>
          <Button
            variant="danger"
            isLoading={del.isPending}
            onClick={async () => {
              if (!confirming) return;
              try {
                await del.mutateAsync(confirming.id);
                setConfirming(null);
              } catch (err) {
                setDeleteError(err instanceof ApiError ? err.message : 'Cilad ayaa dhacday.');
              }
            }}
          >
            Haa, tirtir
          </Button>
        </div>
      </Modal>
    </section>
  );
}
