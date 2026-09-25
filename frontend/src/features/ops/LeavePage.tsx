import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createLeaveRequestSchema,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPES,
  PERMISSIONS,
  type CreateLeaveRequestInput,
} from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DatePicker } from '../../components/ui/DatePicker';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { ApiError } from '../../lib/apiClient';
import { useCreateLeave, useEmployees, useLeave, useUpdateLeave } from './hooks';

export function LeavePage(): ReactNode {
  const query = useLeave();
  const employees = useEmployees();
  const create = useCreateLeave();
  const update = useUpdateLeave();
  const canCreate = useHasPermission(PERMISSIONS.LEAVE_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.LEAVE_UPDATE);
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateLeaveRequestInput>({
    resolver: zodResolver(createLeaveRequestSchema),
    defaultValues: { employeeId: '', type: 'ANNUAL', startDate: '', endDate: '', reason: '' },
  });
  const rows = query.data ?? [];

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await create.mutateAsync(values);
      form.reset({ employeeId: '', type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
      setOpen(false);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Wax baa qaldamay.');
    }
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Fasaxyada</h1>
          <p className="mt-1 text-base text-muted">Codsiyada fasaxa iyo oggolaanshaha.</p>
        </div>
        {canCreate ? <Button onClick={() => setOpen(true)}>Codsi cusub</Button> : null}
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Fasaxyada lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Codsi fasax majiro"
            action={canCreate ? <Button onClick={() => setOpen(true)}>Codsi cusub</Button> : null}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Shaqaalaha</Th>
                <Th>Nooca</Th>
                <Th>Bilow</Th>
                <Th>Dhammaad</Th>
                <Th>Xaalad</Th>
                <Th className="text-end">Ficil</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.employee.user.name}</Td>
                  <Td>{LEAVE_TYPE_LABELS[row.type]}</Td>
                  <Td>{formatDate(row.startDate)}</Td>
                  <Td>{formatDate(row.endDate)}</Td>
                  <Td>
                    <Badge
                      tone={
                        row.status === 'APPROVED'
                          ? 'success'
                          : row.status === 'REJECTED'
                            ? 'error'
                            : 'warning'
                      }
                    >
                      {LEAVE_STATUS_LABELS[row.status]}
                    </Badge>
                  </Td>
                  <Td>
                    {canUpdate && row.status === 'PENDING' ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            update.mutate({ id: row.id, input: { status: 'APPROVED' } })
                          }
                        >
                          Ansixi
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRejecting({ id: row.id, name: row.employee.user.name })}
                        >
                          Diid
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted">{row.rejectionReason ?? '—'}</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Codsi fasax">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Select
            label="Shaqaalaha"
            options={[
              { value: '', label: 'Dooro shaqaale' },
              ...(employees.data ?? []).map((row) => ({
                value: row.id,
                label: `${row.user.name} (${row.employeeNo})`,
              })),
            ]}
            error={form.formState.errors.employeeId?.message}
            {...form.register('employeeId')}
          />
          <Select
            label="Nooca"
            options={LEAVE_TYPES.map((type) => ({ value: type, label: LEAVE_TYPE_LABELS[type] }))}
            {...form.register('type')}
          />
          <DatePicker
            label="Bilowga"
            error={form.formState.errors.startDate?.message}
            {...form.register('startDate')}
          />
          <DatePicker
            label="Dhammaadka"
            error={form.formState.errors.endDate?.message}
            {...form.register('endDate')}
          />
          <Input label="Sababta" {...form.register('reason')} />
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
      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Diid fasaxa">
        <p className="text-base text-ink">
          Ma diidaysaa fasaxa <strong>{rejecting?.name}</strong>?
        </p>
        <div className="mt-4">
          <Input
            label="Sababta diidmada"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRejecting(null)}>
            Maya
          </Button>
          <Button
            variant="danger"
            isLoading={update.isPending}
            onClick={async () => {
              if (!rejecting) return;
              await update.mutateAsync({
                id: rejecting.id,
                input: { status: 'REJECTED', rejectionReason: reason || 'La diiday' },
              });
              setRejecting(null);
              setReason('');
            }}
          >
            Haa, diid
          </Button>
        </div>
      </Modal>
    </section>
  );
}
