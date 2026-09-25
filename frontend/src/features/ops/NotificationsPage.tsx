import { type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { formatDate } from '../../lib/date';
import { useMarkNotificationRead, useNotifications } from './hooks';

export function NotificationsPage(): ReactNode {
  const query = useNotifications();
  const mark = useMarkNotificationRead();
  const rows = query.data ?? [];

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Ogeysiisyada</h1>
      <p className="mt-1 text-base text-muted">
        Dhacdooyinka kugu saabsan — lead, hawlo, iyo wixii la mid ah.
      </p>
      <div className="mt-6">
        {query.isLoading ? (
          <div className="rounded-lg border border-border bg-surface">
            <LoadingState rows={6} label="Waa la soo rarayaa" />
          </div>
        ) : query.isError ? (
          <div className="rounded-lg border border-border bg-surface">
            <ErrorState
              description="Ogeysiisyada lama soo rari karin."
              onRetry={() => query.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState title="Ogeysiis cusub majiro" />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{row.title}</p>
                    <p className="mt-1 text-sm text-muted">{row.body}</p>
                    <p className="mt-2 text-sm text-muted">{formatDate(row.createdAt)}</p>
                  </div>
                  {row.readAt ? (
                    <Badge tone="neutral">La akhriyay</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => mark.mutate(row.id)}>
                      Calaamadee la akhriyay
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
