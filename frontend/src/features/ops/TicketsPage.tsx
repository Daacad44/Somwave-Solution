import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTicketSchema,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  PERMISSIONS,
  type CreateTicketInput,
} from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useCurrentUser } from '../auth/hooks';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { ApiError } from '../../lib/apiClient';
import { useTickets, useCreateTicket } from './hooks';

export function TicketsPage(): ReactNode {
  const { data: user } = useCurrentUser();
  const query = useTickets();
  const create = useCreateTicket();
  const canCreate = useHasPermission(PERMISSIONS.TICKETS_CREATE) && Boolean(user?.clientId);
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
      setServerError(err instanceof ApiError ? err.message : 'Wax baa qaldamay.');
    }
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Tikidhada</h1>
          <p className="mt-1 text-base text-muted">Taageerada macaamiisha.</p>
        </div>
        {canCreate ? <Button onClick={() => setOpen(true)}>Tikidh cusub</Button> : null}
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Tikidhada lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="Tikidh majiro" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Koodh</Th>
                <Th>Mawduuc</Th>
                <Th>Macmiil</Th>
                <Th>Mudnaan</Th>
                <Th>Xaalad</Th>
                <Th>Taariikh</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.code}</Td>
                  <Td>{row.subject}</Td>
                  <Td>{row.client.companyName}</Td>
                  <Td>{TICKET_PRIORITY_LABELS[row.priority]}</Td>
                  <Td>
                    <Badge>{TICKET_STATUS_LABELS[row.status]}</Badge>
                  </Td>
                  <Td className="text-muted">{formatDate(row.createdAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Tikidh cusub">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Mawduuca"
            error={form.formState.errors.subject?.message}
            {...form.register('subject')}
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Faahfaahin</span>
            <textarea
              className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              {...form.register('description')}
            />
          </label>
          <Select
            label="Mudnaan"
            options={[
              { value: 'LOW', label: 'Hoose' },
              { value: 'MEDIUM', label: 'Dhexe' },
              { value: 'HIGH', label: 'Sare' },
              { value: 'URGENT', label: 'Degdeg' },
            ]}
            {...form.register('priority')}
          />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Jooji
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting || create.isPending}>
              Dir
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
