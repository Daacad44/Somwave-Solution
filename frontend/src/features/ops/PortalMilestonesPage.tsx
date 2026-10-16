import { type ReactNode } from 'react';
import { type MilestoneStatus } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { formatDate } from '../../lib/date';
import { usePortalMilestones } from './hooks';

const STATUS_TONE: Record<MilestoneStatus, 'neutral' | 'info' | 'success'> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
};
const STATUS_LABELS: Record<MilestoneStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

export function PortalMilestonesPage(): ReactNode {
  const query = usePortalMilestones();
  const rows = query.data ?? [];

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">My Milestones</h1>
      <p className="mt-1 text-base text-muted">Milestones for projects linked to your account.</p>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Loading milestones" />
        ) : query.isError ? (
          <ErrorState
            description="Milestones could not be loaded."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No milestones yet" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Title</Th>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th>Due date</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.title}</Td>
                  <Td className="text-muted">{row.project.name}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                  </Td>
                  <Td>{formatDate(row.dueDate)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </section>
  );
}
