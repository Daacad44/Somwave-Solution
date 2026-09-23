import { type ReactNode } from 'react';
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  PERMISSIONS,
  type InquiryStatus,
} from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { useLeads, useUpdateLead } from './hooks';

const TONE: Record<InquiryStatus, 'info' | 'success' | 'neutral'> = {
  NEW: 'info',
  READ: 'success',
  ARCHIVED: 'neutral',
};

export function LeadsPage(): ReactNode {
  const query = useLeads();
  const update = useUpdateLead();
  const canUpdate = useHasPermission(PERMISSIONS.LEADS_UPDATE);
  const rows = query.data ?? [];

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Lead-yada</h1>
      <p className="mt-1 text-base text-muted">Codsiyada websaydka (`/nala-soo-xiriir`).</p>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Lead-yada lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="Lead cusub majiro" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Magaca</Th>
                <Th>Iimayl</Th>
                <Th>Fariin</Th>
                <Th>Taariikh</Th>
                <Th>Xaalad</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.name}</Td>
                  <Td>{row.email}</Td>
                  <Td className="max-w-xs truncate text-muted">{row.message}</Td>
                  <Td className="text-muted">{formatDate(row.createdAt)}</Td>
                  <Td>
                    {canUpdate ? (
                      <Select
                        options={INQUIRY_STATUSES.map((value) => ({
                          value,
                          label: INQUIRY_STATUS_LABELS[value],
                        }))}
                        value={row.status}
                        onChange={(event) =>
                          update.mutate({
                            id: row.id,
                            input: { status: event.target.value as InquiryStatus },
                          })
                        }
                      />
                    ) : (
                      <Badge tone={TONE[row.status]}>{INQUIRY_STATUS_LABELS[row.status]}</Badge>
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
