import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createLeaveRequestSchema,
  LEAVE_TYPES,
  PERMISSIONS,
  type CreateLeaveRequestInput,
  type LeaveStatus,
  type LeaveType,
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

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL: 'Annual',
  SICK: 'Sick',
  UNPAID: 'Unpaid',
  OTHER: 'Other',
};
const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

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
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Leave requests</h1>
          <p className="mt-1 text-base text-muted">Leave requests and approvals.</p>
        </div>
        {canCreate ? <Button onClick={() => setOpen(true)}>New request</Button> : null}
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Loading" />
        ) : query.isError ? (
          <ErrorState
            description="Could not load leave requests."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No leave requests"
            action={canCreate ? <Button onClick={() => setOpen(true)}>New request</Button> : null}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Employee</Th>
                <Th>Type</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Status</Th>
                <Th className="text-end">Actions</Th>
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
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRejecting({ id: row.id, name: row.employee.user.name })}
                        >
                          Reject
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
      <Modal open={open} onClose={() => setOpen(false)} title="Leave request">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Select
            label="Employee"
            options={[
              { value: '', label: 'Select an employee' },
              ...(employees.data ?? []).map((row) => ({
                value: row.id,
                label: `${row.user.name} (${row.employeeNo})`,
              })),
            ]}
            error={form.formState.errors.employeeId?.message}
            {...form.register('employeeId')}
          />
          <Select
            label="Type"
            options={LEAVE_TYPES.map((type) => ({ value: type, label: LEAVE_TYPE_LABELS[type] }))}
            {...form.register('type')}
          />
          <DatePicker
            label="Start date"
            error={form.formState.errors.startDate?.message}
            {...form.register('startDate')}
          />
          <DatePicker
            label="End date"
            error={form.formState.errors.endDate?.message}
            {...form.register('endDate')}
          />
          <Input label="Reason" {...form.register('reason')} />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting || create.isPending}>
              Submit
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject leave request"
      >
        <p className="text-base text-ink">
          Reject leave request for <strong>{rejecting?.name}</strong>?
        </p>
        <div className="mt-4">
          <Input
            label="Rejection reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRejecting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={update.isPending}
            onClick={async () => {
              if (!rejecting) return;
              await update.mutateAsync({
                id: rejecting.id,
                input: { status: 'REJECTED', rejectionReason: reason || 'Rejected' },
              });
              setRejecting(null);
              setReason('');
            }}
          >
            Yes, reject
          </Button>
        </div>
      </Modal>
    </section>
  );
}
