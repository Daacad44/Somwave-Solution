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
          <h1 className="text-2xl font-semibold text-ink">Maqaallada (CMS)</h1>
          <p className="mt-1 text-base text-muted">Maamul maqaallada bloogga websaydka.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>Maqaal cusub</Button> : null}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={5} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Maqaallada lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : posts.length === 0 ? (
          <EmptyState
            title="Weli maqaal ma jiro"
            action={canCreate ? <Button onClick={openCreate}>Maqaal cusub</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cinwaan</Th>
                <Th>Qayb</Th>
                <Th>Xaalad</Th>
                <Th>Taariikh</Th>
                <Th className="text-end">Ficil</Th>
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
                          Wax ka beddel
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(post)}>
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
        <PostFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          categories={categoriesQuery.data ?? []}
          post={editing}
        />
      ) : null}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Tirtir maqaalka">
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
