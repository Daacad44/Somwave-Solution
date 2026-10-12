// CMS — blog posts management (W4.2, §9). EDITOR-facing screen; the four states
// (§12) and permission-gated actions (§13). Writes invalidate the public cache.
import { type ReactNode, useState } from 'react';
import type { AdminPost } from '@somwave/shared';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCmsPosts, useCmsCategories, useDeletePost } from './hooks';
import { PostFormModal } from './components/PostFormModal';

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}

export function PostsAdminPage(): ReactNode {
  const query = useCmsPosts();
  const categoriesQuery = useCmsCategories();
  const del = useDeletePost();

  const canCreate = useHasPermission(PERMISSIONS.CONTENT_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.CONTENT_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.CONTENT_DELETE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPost | null>(null);
  const [confirming, setConfirming] = useState<AdminPost | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (post: AdminPost): void => {
    setEditing(post);
    setFormOpen(true);
  };

  const posts = query.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Posts (CMS)</h1>
          <p className="mt-1 text-base text-muted">Manage website blog posts.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>New post</Button> : null}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={5} label="Loading" />
        ) : query.isError ? (
          <ErrorState description="Could not load posts." onRetry={() => query.refetch()} />
        ) : posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            action={canCreate ? <Button onClick={openCreate}>New post</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th>Date</Th>
                <Th className="text-end">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {posts.map((post) => (
                <Tr key={post.id}>
                  <Td className="font-medium">{post.title}</Td>
                  <Td className="text-muted">{post.category?.name ?? '—'}</Td>
                  <Td>
                    <Badge tone={post.isPublished ? 'success' : 'neutral'}>
                      {post.isPublished ? 'La daabacay' : 'Qabyo'}
                    </Badge>
                  </Td>
                  <Td className="text-muted">{formatDate(post.publishedAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(post)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(post)}>
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
        <PostFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          categories={categoriesQuery.data ?? []}
          post={editing}
        />
      ) : null}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Delete post">
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
