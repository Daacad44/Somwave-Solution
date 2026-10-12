// CMS — testimonials management (W5.1, §9). EDITOR-facing screen; the four states
// (§12) and permission-gated actions (§13). Writes invalidate the public cache.
import { type ReactNode, useState } from 'react';
import type { AdminTestimonial } from '@somwave/shared';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCmsTestimonials, useDeleteTestimonial } from './hooks';
import { TestimonialFormModal } from './components/TestimonialFormModal';

export function TestimonialsAdminPage(): ReactNode {
  const query = useCmsTestimonials();
  const del = useDeleteTestimonial();

  const canCreate = useHasPermission(PERMISSIONS.CONTENT_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.CONTENT_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.CONTENT_DELETE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminTestimonial | null>(null);
  const [confirming, setConfirming] = useState<AdminTestimonial | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (testimonial: AdminTestimonial): void => {
    setEditing(testimonial);
    setFormOpen(true);
  };

  const testimonials = query.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Marag-furka (CMS)</h1>
          <p className="mt-1 text-base text-muted">
            Manage client testimonials shown on the website.
          </p>
        </div>
        {canCreate ? <Button onClick={openCreate}>New testimonial</Button> : null}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={5} label="Loading" />
        ) : query.isError ? (
          <ErrorState description="Could not load testimonials." onRetry={() => query.refetch()} />
        ) : testimonials.length === 0 ? (
          <EmptyState
            title="No testimonials yet"
            action={canCreate ? <Button onClick={openCreate}>New testimonial</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Qoraaga</Th>
                <Th>Shirkadda</Th>
                <Th>Qiimeyn</Th>
                <Th>Status</Th>
                <Th className="text-end">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {testimonials.map((testimonial) => (
                <Tr key={testimonial.id}>
                  <Td className="font-medium">{testimonial.author}</Td>
                  <Td className="text-muted">{testimonial.company ?? '—'}</Td>
                  <Td>{testimonial.rating ? `${testimonial.rating}/5` : '—'}</Td>
                  <Td>
                    <Badge tone={testimonial.isPublished ? 'success' : 'neutral'}>
                      {testimonial.isPublished ? 'La daabacay' : 'Qabyo'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(testimonial)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setConfirming(testimonial)}
                        >
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
        <TestimonialFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          testimonial={editing}
        />
      ) : null}

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Delete testimonial"
      >
        <p className="text-base text-ink">
          Are you sure you want to delete testimonial from <strong>{confirming?.author}</strong>?
          This action cannot be undone.
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
