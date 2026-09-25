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
      setServerError('Dooro shaqaale.');
      return;
    }
    setServerError(null);
    try {
      if (action === 'in') await checkIn.mutateAsync(employeeId);
      else await checkOut.mutateAsync(employeeId);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Wax baa qaldamay.');
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Imaanshaha</h1>
          <p className="mt-1 text-base text-muted">Soo-galidda iyo bixitaanka maalinlaha ah.</p>
        </div>
      </div>
      {canWrite ? (
        <div className="mt-6 flex flex-wrap items-end gap-2">
          <Select
            label="Shaqaalaha"
            options={[
              { value: '', label: 'Dooro shaqaale' },
              ...(employees.data ?? []).map((row) => ({
                value: row.id,
                label: `${row.user.name} (${row.employeeNo})`,
              })),
            ]}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
          <Button onClick={() => void run('in')} isLoading={checkIn.isPending}>
            Soo gal
          </Button>
          <Button
            variant="secondary"
            onClick={() => void run('out')}
            isLoading={checkOut.isPending}
          >
            Bax
          </Button>
        </div>
      ) : null}
      {serverError ? <p className="mt-3 text-sm text-error">{serverError}</p> : null}
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Imaanshaha lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="Diiwaan imaansho majiro" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Shaqaalaha</Th>
                <Th>Taariikh</Th>
                <Th>Soo-galid</Th>
                <Th>Bixitaan</Th>
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
