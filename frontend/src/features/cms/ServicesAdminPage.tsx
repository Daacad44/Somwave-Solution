// CMS — website services management (W4, §9). EDITOR-facing screen using the
// same UI kit and RBAC as the internal system. The four states (§12), and
// permission-gated actions (§13). Writes invalidate the public site's cache.
import { type ReactNode, useState } from 'react';
import type { AdminService } from '@somwave/shared';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCmsServices, useDeleteService } from './hooks';
import { ServiceFormModal } from './components/ServiceFormModal';

export function ServicesAdminPage(): ReactNode {
  const query = useCmsServices();
  const del = useDeleteService();

  const canCreate = useHasPermission(PERMISSIONS.CONTENT_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.CONTENT_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.CONTENT_DELETE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [confirming, setConfirming] = useState<AdminService | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (service: AdminService): void => {
    setEditing(service);
    setFormOpen(true);
  };

  const services = query.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Services (CMS)</h1>
          <p className="mt-1 text-base text-muted">Manage services shown on the public website.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>New service</Button> : null}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={5} label="Loading" />
        ) : query.isError ? (
          <ErrorState description="Could not load services." onRetry={() => query.refetch()} />
        ) : services.length === 0 ? (
          <EmptyState
            title="No services yet"
            action={canCreate ? <Button onClick={openCreate}>New service</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Title</Th>
                <Th>Slug</Th>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th className="text-end">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {services.map((service) => (
                <Tr key={service.id}>
                  <Td className="font-medium">{service.title}</Td>
                  <Td className="text-muted">{service.slug}</Td>
                  <Td>{service.order}</Td>
                  <Td>
                    <Badge tone={service.isPublished ? 'success' : 'neutral'}>
                      {service.isPublished ? 'La daabacay' : 'Qabyo'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(service)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(service)}>
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

      {formOpen ? (
        <ServiceFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          service={editing}
        />
      ) : null}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Delete service">
        <p className="text-base text-ink">
          Are you sure you want to delete <strong>{confirming?.title}</strong>? This action cannot
          be undone.
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
