// CMS — FAQ management (W5.3, §9). EDITOR-facing screen; the four states (§12)
// and permission-gated actions (§13). Writes invalidate the public cache.
import { type ReactNode, useState } from 'react';
import type { AdminFaq } from '@somwave/shared';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCmsFaqs, useDeleteFaq } from './hooks';
import { FaqFormModal } from './components/FaqFormModal';

export function FaqAdminPage(): ReactNode {
  const query = useCmsFaqs();
  const del = useDeleteFaq();

  const canCreate = useHasPermission(PERMISSIONS.CONTENT_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.CONTENT_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.CONTENT_DELETE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminFaq | null>(null);
  const [confirming, setConfirming] = useState<AdminFaq | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (faq: AdminFaq): void => {
    setEditing(faq);
    setFormOpen(true);
  };

  const faqs = query.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">FAQs (CMS)</h1>
          <p className="mt-1 text-base text-muted">Manage frequently asked questions.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>New question</Button> : null}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={5} label="Loading" />
        ) : query.isError ? (
          <ErrorState description="Could not load FAQs." onRetry={() => query.refetch()} />
        ) : faqs.length === 0 ? (
          <EmptyState
            title="No FAQs yet"
            action={canCreate ? <Button onClick={openCreate}>New question</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Question</Th>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th className="text-end">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {faqs.map((faq) => (
                <Tr key={faq.id}>
                  <Td className="font-medium">{faq.question}</Td>
                  <Td>{faq.order}</Td>
                  <Td>
                    <Badge tone={faq.isPublished ? 'success' : 'neutral'}>
                      {faq.isPublished ? 'La daabacay' : 'Qabyo'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(faq)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(faq)}>
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
        <FaqFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          faq={editing}
        />
      ) : null}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Delete question">
        <p className="text-base text-ink">
          Are you sure you want to delete this question? This action cannot be undone.
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
