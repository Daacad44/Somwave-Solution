import { type ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTicketReplySchema,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  PERMISSIONS,
  ROLES,
  type CreateTicketReplyInput,
  type TicketPriority,
  type TicketStatus,
} from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { hasRole, useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { ApiError } from '../../lib/apiClient';
import { useCurrentUser } from '../auth/hooks';
import { useTicket, useUpdateTicket, useTicketAssignees, useCreateTicketReply } from './hooks';

const STAFF_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting',
  RESOLVED: 'Resolved',
};
const STAFF_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function TicketDetailPage(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useCurrentUser();
  const isPortalClient = hasRole(user, ROLES.CLIENT);
  const t = (english: string, somali: string): string => (isPortalClient ? somali : english);
  const query = useTicket(id);
  const update = useUpdateTicket();
  const reply = useCreateTicketReply();
  const canUpdate = useHasPermission(PERMISSIONS.TICKETS_UPDATE);
  const assignees = useTicketAssignees(canUpdate);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateTicketReplyInput>({
    resolver: zodResolver(createTicketReplySchema),
    defaultValues: { body: '' },
  });

  const ticket = query.data;

  const onReply = form.handleSubmit(async (values) => {
    if (!ticket) return;
    setServerError(null);
    try {
      await reply.mutateAsync({ id: ticket.id, input: values });
      form.reset({ body: '' });
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : t('Something went wrong.', 'Wax baa qaldamay.'),
      );
    }
  });

  if (query.isLoading) {
    return (
      <section>
        <LoadingState rows={8} label={t('Loading', 'Waa la soo rarayaa')} />
      </section>
    );
  }
  if (query.isError || !ticket) {
    return (
      <section>
        <ErrorState
          description={t('This ticket could not be loaded.', 'Tikidhkan lama soo rari karin.')}
          onRetry={() => query.refetch()}
        />
        <Link
          to="/tickets"
          className="mt-4 inline-block text-sm text-primary underline-offset-2 hover:underline"
        >
          {t('Back to list', 'Ku noqo liiska')}
        </Link>
      </section>
    );
  }

  return (
    <section>
      <p className="text-sm text-muted">
        <Link to="/tickets" className="underline-offset-2 hover:underline">
          {t('Tickets', 'Tikidhada')}
        </Link>
        <span className="mx-1">/</span>
        {ticket.code}
      </p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{ticket.subject}</h1>
          <p className="mt-1 text-base text-muted">{ticket.client.companyName}</p>
        </div>
        <Badge>
          {isPortalClient
            ? TICKET_PRIORITY_LABELS[ticket.priority]
            : STAFF_PRIORITY_LABELS[ticket.priority]}
        </Badge>
      </div>

      <dl className="mt-6 grid gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">{t('Status', 'Xaalad')}</dt>
          <dd className="mt-1">
            {canUpdate ? (
              <Select
                options={TICKET_STATUSES.map((value) => ({
                  value,
                  label: isPortalClient ? TICKET_STATUS_LABELS[value] : STAFF_STATUS_LABELS[value],
                }))}
                value={ticket.status}
                onChange={(event) =>
                  update.mutate({
                    id: ticket.id,
                    input: { status: event.target.value as TicketStatus },
                  })
                }
              />
            ) : (
              <Badge>
                {isPortalClient
                  ? TICKET_STATUS_LABELS[ticket.status]
                  : STAFF_STATUS_LABELS[ticket.status]}
              </Badge>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{t('Assigned to', 'Loo xilsaaray')}</dt>
          <dd className="mt-1">
            {canUpdate ? (
              <Select
                options={[
                  { value: '', label: t('Unassigned', 'Lama xilin') },
                  ...(assignees.data ?? []).map((person) => ({
                    value: person.id,
                    label: person.name,
                  })),
                ]}
                value={ticket.assignee?.id ?? ''}
                onChange={(event) =>
                  update.mutate({
                    id: ticket.id,
                    input: { assigneeId: event.target.value || null },
                  })
                }
              />
            ) : (
              <span className="text-base text-ink">{ticket.assignee?.name ?? '—'}</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">{t('Description', 'Faahfaahin')}</h2>
        <p className="mt-2 whitespace-pre-wrap text-base text-ink">{ticket.description}</p>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-ink">{t('Replies', 'Jawaabaha')}</h2>
        <div className="mt-3 rounded-lg border border-border bg-surface">
          {ticket.replies.length === 0 ? (
            <EmptyState
              title={t('No replies', 'Jawaab majiro')}
              description={t('Write the first reply.', 'Ku qor jawaabta ugu horreysa.')}
            />
          ) : (
            <ul className="divide-y divide-border">
              {ticket.replies.map((item) => (
                <li key={item.id} className="p-4">
                  <p className="text-sm font-medium text-ink">{item.author.name}</p>
                  <p className="text-sm text-muted">{formatDate(item.createdAt)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-base text-ink">{item.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <form onSubmit={onReply} className="mt-6 flex flex-col gap-3" noValidate>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">{t('New reply', 'Jawaab cusub')}</span>
          <textarea
            className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            {...form.register('body')}
          />
          {form.formState.errors.body ? (
            <span className="text-sm text-error">{form.formState.errors.body.message}</span>
          ) : null}
        </label>
        {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" isLoading={form.formState.isSubmitting || reply.isPending}>
            {t('Send reply', 'Dir jawaab')}
          </Button>
        </div>
      </form>
    </section>
  );
}
