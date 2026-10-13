import { type ReactNode } from 'react';
import { APPLICATION_STATUSES, PERMISSIONS, type ApplicationStatus } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { useApplications, useUpdateApplication } from './hooks';

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  NEW: 'New',
  REVIEWING: 'Reviewing',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Rejected',
  HIRED: 'Hired',
};

export function ApplicationsPage(): ReactNode {
  const query = useApplications();
  const update = useUpdateApplication();
  const canUpdate = useHasPermission(PERMISSIONS.APPLICATIONS_UPDATE);
  const rows = query.data ?? [];

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Job applications</h1>
      <p className="mt-1 text-base text-muted">Applications submitted through the careers page.</p>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Loading" />
        ) : query.isError ? (
          <ErrorState description="Could not load applications." onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No new applications" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Opening</Th>
                <Th>Email</Th>
                <Th>Date</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.name}</Td>
                  <Td>{row.jobOpening.title}</Td>
                  <Td>{row.email}</Td>
                  <Td className="text-muted">{formatDate(row.createdAt)}</Td>
                  <Td>
                    {canUpdate ? (
                      <Select
                        options={APPLICATION_STATUSES.map((value) => ({
                          value,
                          label: APPLICATION_STATUS_LABELS[value],
                        }))}
                        value={row.status}
                        onChange={(event) =>
                          update.mutate({
                            id: row.id,
                            input: { status: event.target.value as ApplicationStatus },
                          })
                        }
                      />
                    ) : (
                      <Badge>{APPLICATION_STATUS_LABELS[row.status]}</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </section>
  );
}
