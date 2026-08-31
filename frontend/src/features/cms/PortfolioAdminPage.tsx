// CMS — portfolio management (W4.3, §9). EDITOR-facing screen; the four states
// (§12) and permission-gated actions (§13). Writes invalidate the public cache.
import { type ReactNode, useState } from 'react';
import type { AdminPortfolioItem } from '@somwave/shared';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCmsPortfolio, useDeletePortfolio } from './hooks';
import { PortfolioFormModal } from './components/PortfolioFormModal';

export function PortfolioAdminPage(): ReactNode {
  const query = useCmsPortfolio();
  const del = useDeletePortfolio();

  const canCreate = useHasPermission(PERMISSIONS.CONTENT_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.CONTENT_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.CONTENT_DELETE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPortfolioItem | null>(null);
  const [confirming, setConfirming] = useState<AdminPortfolioItem | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (item: AdminPortfolioItem): void => {
    setEditing(item);
    setFormOpen(true);
  };

  const items = query.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Shaqooyinka (CMS)</h1>
          <p className="mt-1 text-base text-muted">Maamul shaqooyinka la soo bandhigo websaydka.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>Shaqo cusub</Button> : null}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={5} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Shaqooyinka lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Weli shaqo ma jirto"
            action={canCreate ? <Button onClick={openCreate}>Shaqo cusub</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cinwaan</Th>
                <Th>Macmiil</Th>
                <Th>Kala horreyn</Th>
                <Th>Xaalad</Th>
                <Th className="text-end">Ficil</Th>
              </Tr>
            </THead>
            <TBody>
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.title}</Td>
                  <Td className="text-muted">{item.client ?? '—'}</Td>
                  <Td>{item.order}</Td>
                  <Td>
                    <Badge tone={item.isPublished ? 'success' : 'neutral'}>
                      {item.isPublished ? 'La daabacay' : 'Qabyo'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                          Wax ka beddel
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(item)}>
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
        <PortfolioFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          item={editing}
        />
      ) : null}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Tirtir shaqada">
        <p className="text-base text-ink">
          Ma hubtaa inaad tirtirayso <strong>{confirming?.title}</strong>? Tallaabadan lama soo
          celin karo.
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
