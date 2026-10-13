import { type ReactNode, useState } from 'react';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { ApiError } from '../../lib/apiClient';
import { useAttendance, useCheckIn, useCheckOut, useEmployees } from './hooks';

export function AttendancePage(): ReactNode {
  const query = useAttendance();
  const employees = useEmployees();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const canWrite = useHasPermission(PERMISSIONS.ATTENDANCE_CREATE);
  const [employeeId, setEmployeeId] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const rows = query.data ?? [];

  const run = async (action: 'in' | 'out'): Promise<void> => {
    if (!employeeId) {
      setServerError('Select an employee.');
      return;
    }
    setServerError(null);
    try {
      if (action === 'in') await checkIn.mutateAsync(employeeId);
      else await checkOut.mutateAsync(employeeId);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Attendance</h1>
          <p className="mt-1 text-base text-muted">Daily clock-in and clock-out records.</p>
        </div>
      </div>
      {canWrite ? (
        <div className="mt-6 flex flex-wrap items-end gap-2">
          <Select
            label="Employee"
            options={[
              { value: '', label: 'Select an employee' },
              ...(employees.data ?? []).map((row) => ({
                value: row.id,
                label: `${row.user.name} (${row.employeeNo})`,
              })),
            ]}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
          <Button onClick={() => void run('in')} isLoading={checkIn.isPending}>
            Clock in
          </Button>
          <Button
            variant="secondary"
            onClick={() => void run('out')}
            isLoading={checkOut.isPending}
          >
            Clock out
          </Button>
        </div>
      ) : null}
      {serverError ? <p className="mt-3 text-sm text-error">{serverError}</p> : null}
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Loading" />
        ) : query.isError ? (
          <ErrorState description="Could not load attendance." onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No attendance records" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Employee</Th>
                <Th>Date</Th>
                <Th>Clock-in</Th>
                <Th>Clock-out</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.employee.user.name}</Td>
                  <Td>{formatDate(row.date)}</Td>
                  <Td>{row.checkInAt ? formatDate(row.checkInAt) : '—'}</Td>
                  <Td>{row.checkOutAt ? formatDate(row.checkOutAt) : '—'}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </section>
  );
}
