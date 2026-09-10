import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTimesheetSchema,
  TIMESHEET_STATUS_LABELS,
  PERMISSIONS,
  type CreateTimesheetInput,
} from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/ui/DatePicker';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { ApiError } from '../../lib/apiClient';
import { useTimesheets, useCreateTimesheet, useUpdateTimesheet } from './hooks';

export function TimesheetsPage(): ReactNode {
  const query = useTimesheets();
  const create = useCreateTimesheet();
  const update = useUpdateTimesheet();
  const canCreate = useHasPermission(PERMISSIONS.TIMESHEETS_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.TIMESHEETS_UPDATE);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateTimesheetInput>({
    resolver: zodResolver(createTimesheetSchema),
    defaultValues: { hours: '8', isBillable: true, date: '' },
  });
  const rows = query.data ?? [];

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await create.mutateAsync(values);
      form.reset({ hours: '8', isBillable: true, date: '' });
      setOpen(false);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Wax baa qaldamay.');
    }
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Saacadaha shaqada</h1>
          <p className="mt-1 text-base text-muted">Diiwaangeli saacadahaada.</p>
        </div>
        {canCreate ? <Button onClick={() => setOpen(true)}>Diiwaan cusub</Button> : null}
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Saacadaha lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="Weli saacad lama diiwaangelin" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Taariikh</Th>
                <Th>Saacado</Th>
                <Th>Mashruuc</Th>
                <Th>Xaalad</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>{formatDate(row.date)}</Td>
                  <Td>{row.hours}</Td>
                  <Td>{row.project?.name ?? '—'}</Td>
                  <Td>
                    {canUpdate && row.status === 'PENDING' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => update.mutate({ id: row.id, input: { status: 'APPROVED' } })}
                      >
                        Ansixi
                      </Button>
                    ) : (
                      <Badge>{TIMESHEET_STATUS_LABELS[row.status]}</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Saacad cusub">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <DatePicker
            label="Taariikhda"
            error={form.formState.errors.date?.message}
            {...form.register('date')}
          />
          <Input
            label="Saacado"
            error={form.formState.errors.hours?.message}
            {...form.register('hours')}
          />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Jooji
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting || create.isPending}>
              Kaydi
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
