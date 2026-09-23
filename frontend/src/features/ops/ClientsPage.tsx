import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createClientSchema,
  CLIENT_STATUS_LABELS,
  PERMISSIONS,
  type CreateClientInput,
} from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { ApiError } from '../../lib/apiClient';
import { useClients, useCreateClient } from './hooks';

export function ClientsPage(): ReactNode {
  const query = useClients();
  const create = useCreateClient();
  const canCreate = useHasPermission(PERMISSIONS.CLIENTS_CREATE);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { companyName: '', status: 'ACTIVE' },
  });
  const rows = query.data ?? [];

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await create.mutateAsync(values);
      form.reset();
      setOpen(false);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Wax baa qaldamay.');
    }
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Macaamiisha</h1>
          <p className="mt-1 text-base text-muted">Diiwaanka shirkadaha portal-ka.</p>
        </div>
        {canCreate ? <Button onClick={() => setOpen(true)}>Macmiil cusub</Button> : null}
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Macaamiisha lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Macmiil majiro"
            action={canCreate ? <Button onClick={() => setOpen(true)}>Macmiil cusub</Button> : null}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Shirkadda</Th>
                <Th>Iimayl</Th>
                <Th>Xaalad</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.companyName}</Td>
                  <Td>{row.email ?? '—'}</Td>
                  <Td>
                    <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {CLIENT_STATUS_LABELS[row.status]}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Macmiil cusub">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Magaca shirkadda"
            error={form.formState.errors.companyName?.message}
            {...form.register('companyName')}
          />
          <Input label="Iimayl" type="email" {...form.register('email')} />
          <Input label="Telefoon" {...form.register('phone')} />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Jooji
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting || create.isPending}>
              Abuur
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
