import { type ReactNode } from 'react';
import { MILESTONE_STATUS_LABELS, type MilestoneStatus } from '@somwave/shared';
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

export function PortalMilestonesPage(): ReactNode {
  const query = usePortalMilestones();
  const rows = query.data ?? [];

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Marxaladahayga</h1>
      <p className="mt-1 text-base text-muted">Marxaladaha mashruucyada ku xiran akoonkaaga.</p>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Marxaladaha lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="Marxalad kuma xirna" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cinwaan</Th>
                <Th>Mashruuc</Th>
                <Th>Xaalad</Th>
                <Th>Dhicitaanka</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.title}</Td>
                  <Td className="text-muted">{row.project.name}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[row.status]}>
                      {MILESTONE_STATUS_LABELS[row.status]}
                    </Badge>
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
