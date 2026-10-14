import { type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { formatDate } from '../../lib/date';
import { useMarkNotificationRead, useNotifications } from './hooks';
import { NOTIFICATION_EVENTS, notificationApi } from './notificationApi';

export function NotificationsPage(): ReactNode {
  const query = useNotifications();
  const mark = useMarkNotificationRead();
  const rows = query.data ?? [];
  const client = useQueryClient();
  const [preferenceError, setPreferenceError] = useState('');
  const preferences = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationApi.preferences,
  });
  const deliveries = useQuery({
    queryKey: ['notification-deliveries'],
    queryFn: notificationApi.deliveries,
  });
  const updatePreference = useMutation({
    mutationFn: ({
      eventKey,
      inApp,
      email,
    }: {
      eventKey: string;
      inApp: boolean;
      email: boolean;
    }) => notificationApi.setPreference(eventKey, inApp, email),
    onSuccess: () => {
      setPreferenceError('');
      void client.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
    onError: (error: Error) => setPreferenceError(error.message),
  });

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
      <p className="mt-1 text-base text-muted">Updates about leads, tasks, and other activity.</p>
      <div className="mt-6">
        {query.isLoading ? (
          <div className="rounded-lg border border-border bg-surface">
            <LoadingState rows={6} label="Loading" />
          </div>
        ) : query.isError ? (
          <div className="rounded-lg border border-border bg-surface">
            <ErrorState
              description="Could not load notifications."
              onRetry={() => query.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState
              title="No new notifications"
              description="New lead and other event notifications will appear here."
            />
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
                    <Badge tone="neutral">Read</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => mark.mutate(row.id)}>
                      Mark as read
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Delivery preferences</h2>
        <p className="mt-1 text-sm text-muted">
          Choose how engineering events reach you. Email delivery requires Resend to be configured
          on the backend.
        </p>
        {preferenceError ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {preferenceError}
          </p>
        ) : null}
        {preferences.isError ? (
          <ErrorState
            description="Could not load preferences."
            onRetry={() => void preferences.refetch()}
          />
        ) : (
          <div className="mt-3 space-y-2">
            {NOTIFICATION_EVENTS.map((eventKey) => {
              const value = preferences.data?.find((item) => item.eventKey === eventKey);
              const inApp = value?.inApp ?? true;
              const email = value?.email ?? true;
              return (
                <div
                  key={eventKey}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2 text-sm"
                >
                  <span>{eventKey.replaceAll('.', ' ').replaceAll('_', ' ')}</span>
                  <div className="flex gap-4">
                    <label>
                      <input
                        type="checkbox"
                        checked={inApp}
                        disabled={updatePreference.isPending || preferences.isLoading}
                        onChange={(event) =>
                          updatePreference.mutate({ eventKey, inApp: event.target.checked, email })
                        }
                      />{' '}
                      In app
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={email}
                        disabled={updatePreference.isPending || preferences.isLoading}
                        onChange={(event) =>
                          updatePreference.mutate({ eventKey, inApp, email: event.target.checked })
                        }
                      />{' '}
                      Email
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Recent delivery status</h2>
        {deliveries.isError ? (
          <ErrorState
            description="Could not load delivery status."
            onRetry={() => void deliveries.refetch()}
          />
        ) : deliveries.data?.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {deliveries.data.slice(0, 20).map((delivery) => (
              <li key={delivery.id}>
                {delivery.notification.title} · {delivery.channel} ·{' '}
                {delivery.status.replaceAll('_', ' ')}
                {delivery.attempts > 0 ? ` · ${delivery.attempts} attempt(s)` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No delivery attempts yet.</p>
        )}
      </div>
    </section>
  );
}
