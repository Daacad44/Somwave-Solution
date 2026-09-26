import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  PERMISSIONS,
  type InquiryStatus,
} from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { ApiError } from '../../lib/apiClient';
import { formatDate } from '../../lib/date';
import { useConvertLead, useLeads, useUpdateLead } from './hooks';

const TONE: Record<InquiryStatus, 'info' | 'success' | 'neutral'> = {
  NEW: 'info',
  READ: 'success',
  ARCHIVED: 'neutral',
};

export function LeadsPage(): ReactNode {
  const query = useLeads();
  const update = useUpdateLead();
  const convert = useConvertLead();
  const [convertError, setConvertError] = useState<string | null>(null);
  const canUpdate = useHasPermission(PERMISSIONS.LEADS_UPDATE);
  const canCreateClient = useHasPermission(PERMISSIONS.CLIENTS_CREATE);
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
          <EmptyState
            title="Lead cusub majiro"
            description="Foomka xiriirka ee websaydka ayaa lead-yada halkan keena."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Magaca</Th>
                <Th>Iimayl</Th>
                <Th>Fariin</Th>
                <Th>Taariikh</Th>
                <Th>Xaalad</Th>
                <Th className="text-end">Ficil</Th>
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
                  <Td className="text-end">
                    {row.convertedClientId ? (
                      <Link
                        to={`/clients/${row.convertedClientId}`}
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        Macmiilka
                      </Link>
                    ) : canUpdate && canCreateClient ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={convert.isPending && convert.variables === row.id}
                        onClick={() => {
                          setConvertError(null);
                          convert.mutate(row.id, {
                            onError: (err) =>
                              setConvertError(
                                err instanceof ApiError
                                  ? err.message
                                  : 'Lead-ka lama beddeli karin.',
                              ),
                          });
                        }}
                      >
                        U beddel macmiil
                      </Button>
                    ) : (
                      '—'
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      {convertError ? <p className="mt-3 text-sm text-error">{convertError}</p> : null}
    </section>
  );
}
