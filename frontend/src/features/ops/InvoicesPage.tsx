import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createInvoiceSchema,
  INVOICE_STATUS_LABELS,
  PERMISSIONS,
  type CreateInvoiceInput,
} from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/ui/DatePicker';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { ApiError } from '../../lib/apiClient';
import { useInvoices, useCreateInvoice, useClients } from './hooks';

export function InvoicesPage(): ReactNode {
  const query = useInvoices();
  const create = useCreateInvoice();
  const canCreate = useHasPermission(PERMISSIONS.INVOICES_CREATE);
  const clients = useClients({ enabled: canCreate });
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      clientId: '',
      issueDate: '',
      dueDate: '',
      items: [{ description: '', quantity: '1', unitPrice: '0' }],
    },
  });
  const rows = query.data ?? [];

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await create.mutateAsync(values);
      setOpen(false);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Wax baa qaldamay.');
    }
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Biilasha</h1>
          <p className="mt-1 text-base text-muted">Qabyo-dhis iyo liiska biilasha.</p>
        </div>
        {canCreate ? <Button onClick={() => setOpen(true)}>Biil cusub</Button> : null}
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState description="Biilasha lama soo rari karin." onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="Biil majiro" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Lambarka</Th>
                <Th>Macmiil</Th>
                <Th>Wadarta</Th>
                <Th>Dhicitaanka</Th>
                <Th>Xaalad</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.number}</Td>
                  <Td>{row.client.companyName}</Td>
                  <Td>${row.total}</Td>
                  <Td>{formatDate(row.dueDate)}</Td>
                  <Td>
                    <Badge>{INVOICE_STATUS_LABELS[row.status]}</Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Biil cusub">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Select
            label="Macmiil"
            options={(clients.data ?? []).map((client) => ({
              value: client.id,
              label: client.companyName,
            }))}
            error={form.formState.errors.clientId?.message}
            {...form.register('clientId')}
          />
          <DatePicker
            label="La soo saaray"
            error={form.formState.errors.issueDate?.message}
            {...form.register('issueDate')}
          />
          <DatePicker
            label="Dhicitaanka"
            error={form.formState.errors.dueDate?.message}
            {...form.register('dueDate')}
          />
          <Input
            label="Sharaxaad"
            error={form.formState.errors.items?.[0]?.description?.message}
            {...form.register('items.0.description')}
          />
          <Input label="Tirada" {...form.register('items.0.quantity')} />
          <Input label="Qiimaha (USD)" {...form.register('items.0.unitPrice')} />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Jooji
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting || create.isPending}>
              Abuur qabyo
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
