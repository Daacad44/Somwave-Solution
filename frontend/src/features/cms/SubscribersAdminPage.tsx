// CMS — newsletter subscribers (W5.4, §9). Read + remove only (the list is
// captured from the public site). The four states (§12) and permission-gated
// actions (§13).
import { type ReactNode, useState } from 'react';
import type { AdminSubscriber } from '@somwave/shared';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCmsSubscribers, useDeleteSubscriber } from './hooks';

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function SubscribersAdminPage(): ReactNode {
  const query = useCmsSubscribers();
  const del = useDeleteSubscriber();
  const canDelete = useHasPermission(PERMISSIONS.CONTENT_DELETE);

  const [confirming, setConfirming] = useState<AdminSubscriber | null>(null);

  const subscribers = query.data ?? [];

  return (
    <section>
      <div>
        <h1 className="text-2xl font-semibold text-ink">Diiwaangelinta warsidaha (CMS)</h1>
        <p className="mt-1 text-base text-muted">
          Dadka iska diiwaangeliyay warsidaha iimaylka ee websaydka.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Diiwaangelinta lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : subscribers.length === 0 ? (
          <EmptyState title="Weli qof ma diiwaangelin" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Iimayl</Th>
                <Th>Taariikh</Th>
                <Th>Xaalad</Th>
                <Th className="text-end">Ficil</Th>
              </Tr>
            </THead>
            <TBody>
              {subscribers.map((subscriber) => (
                <Tr key={subscriber.id}>
                  <Td className="font-medium">{subscriber.email}</Td>
                  <Td className="text-muted">{formatDate(subscriber.createdAt)}</Td>
                  <Td>
                    <Badge tone={subscriber.isActive ? 'success' : 'neutral'}>
                      {subscriber.isActive ? 'Firfircoon' : 'Joogsan'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setConfirming(subscriber)}
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

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Tirtir diiwaangalaha"
      >
        <p className="text-base text-ink">
          Ma hubtaa inaad ka saarto <strong>{confirming?.email}</strong>? Tallaabadan lama soo celin
          karo.
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
