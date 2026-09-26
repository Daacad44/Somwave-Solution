import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PROJECT_STATUS_LABELS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { formatDate } from '../../lib/date';
import { usePortalProjects } from './hooks';

export function PortalProjectsPage(): ReactNode {
  const query = usePortalProjects();
  const rows = query.data ?? [];

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Mashruucyadayda</h1>
      <p className="mt-1 text-base text-muted">Mashruucyada ku xiran akoonkaaga.</p>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Mashruucyada lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Mashruuc kuma xirna"
            description="Mashruucyada kooxda gudaha kuu abuurtay ayaa halkan ka muuqan doona."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Magaca</Th>
                <Th>Xaalad</Th>
                <Th>Dhicitaanka</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Link
                      to={`/portal/projects/${row.id}`}
                      className="font-medium text-ink hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {row.name}
                    </Link>
                  </Td>
                  <Td>
                    <Badge>{PROJECT_STATUS_LABELS[row.status]}</Badge>
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
