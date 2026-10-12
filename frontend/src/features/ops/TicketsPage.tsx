import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTicketSchema,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  PERMISSIONS,
  ROLES,
  type CreateTicketInput,
  type TicketPriority,
  type TicketStatus,
} from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useCurrentUser } from '../auth/hooks';
import { hasRole, useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { ApiError } from '../../lib/apiClient';
import { useTickets, useCreateTicket, useUpdateTicket } from './hooks';

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

export function TicketsPage(): ReactNode {
  const { data: user } = useCurrentUser();
  const isPortalClient = hasRole(user, ROLES.CLIENT);
  const t = (english: string, somali: string): string => (isPortalClient ? somali : english);
  const query = useTickets();
  const create = useCreateTicket();
  const update = useUpdateTicket();
  const canCreate = useHasPermission(PERMISSIONS.TICKETS_CREATE) && Boolean(user?.clientId);
  const canUpdate = useHasPermission(PERMISSIONS.TICKETS_UPDATE);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { subject: '', description: '', priority: 'MEDIUM' },
  });
  const rows = query.data ?? [];

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await create.mutateAsync(values);
      form.reset({ subject: '', description: '', priority: 'MEDIUM' });
      setOpen(false);
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : t('Something went wrong.', 'Wax baa qaldamay.'),
      );
    }
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{t('Tickets', 'Tikidhada')}</h1>
          <p className="mt-1 text-base text-muted">
            {t('Customer support.', 'Taageerada macaamiisha.')}
          </p>
        </div>
        {canCreate ? (
          <Button onClick={() => setOpen(true)}>{t('New ticket', 'Tikidh cusub')}</Button>
        ) : null}
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label={t('Loading', 'Waa la soo rarayaa')} />
        ) : query.isError ? (
          <ErrorState
            description={t('Tickets could not be loaded.', 'Tikidhada lama soo rari karin.')}
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState title={t('No tickets', 'Tikidh majiro')} />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>{t('Code', 'Koodh')}</Th>
                <Th>{t('Subject', 'Mawduuc')}</Th>
                <Th>{t('Client', 'Macmiil')}</Th>
                <Th>{t('Priority', 'Mudnaan')}</Th>
                <Th>{t('Status', 'Xaalad')}</Th>
                <Th>{t('Date', 'Taariikh')}</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">
                    <Link
                      to={`/tickets/${row.id}`}
                      className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {row.code}
                    </Link>
                  </Td>
                  <Td>{row.subject}</Td>
                  <Td>{row.client.companyName}</Td>
                  <Td>
                    {isPortalClient
                      ? TICKET_PRIORITY_LABELS[row.priority]
                      : STAFF_PRIORITY_LABELS[row.priority]}
                  </Td>
                  <Td>
                    {canUpdate ? (
                      <Select
                        options={TICKET_STATUSES.map((value) => ({
                          value,
                          label: isPortalClient
                            ? TICKET_STATUS_LABELS[value]
                            : STAFF_STATUS_LABELS[value],
                        }))}
                        value={row.status}
                        onChange={(event) =>
                          update.mutate({
                            id: row.id,
                            input: { status: event.target.value as TicketStatus },
                          })
                        }
                      />
                    ) : (
                      <Badge>
                        {isPortalClient
                          ? TICKET_STATUS_LABELS[row.status]
                          : STAFF_STATUS_LABELS[row.status]}
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-muted">{formatDate(row.createdAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t('New ticket', 'Tikidh cusub')}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label={t('Subject', 'Mawduuca')}
            error={form.formState.errors.subject?.message}
            {...form.register('subject')}
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">{t('Description', 'Faahfaahin')}</span>
            <textarea
              className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              {...form.register('description')}
            />
          </label>
          <Select
            label={t('Priority', 'Mudnaan')}
            options={[
              { value: 'LOW', label: t('Low', 'Hoose') },
              { value: 'MEDIUM', label: t('Medium', 'Dhexe') },
              { value: 'HIGH', label: t('High', 'Sare') },
              { value: 'URGENT', label: t('Urgent', 'Degdeg') },
            ]}
            {...form.register('priority')}
          />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t('Cancel', 'Jooji')}
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting || create.isPending}>
              {t('Submit', 'Dir')}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
