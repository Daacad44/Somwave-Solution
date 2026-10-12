import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { formatDate } from '../../lib/date';
import { useAuditLogs } from './hooks';

const PAGE_SIZE = 20;

export function AuditPage(): ReactNode {
  const query = useAuditLogs();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? []).filter((row) => {
      if (!q) return true;
      return [row.action, row.subjectType, row.subjectId, row.actorId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [query.data, search]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onSearch = (event: FormEvent): void => {
    event.preventDefault();
    setPage(1);
  };

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Audit log</h1>
      <p className="mt-1 text-base text-muted">A permanent record of who did what and when.</p>
      <form onSubmit={onSearch} className="mt-6 flex max-w-md gap-2">
        <Input
          placeholder="Search action or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search audit log"
          className="flex-1"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Loading" />
        ) : query.isError ? (
          <ErrorState description="Could not load audit records." onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No audit records" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Actions</Th>
                <Th>Type</Th>
                <Th>Aqoonsi</Th>
                <Th>Qofka</Th>
                <Th>Time</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.action}</Td>
                  <Td>{row.subjectType}</Td>
                  <Td className="font-mono text-sm">{row.subjectId ?? '—'}</Td>
                  <Td className="font-mono text-sm">{row.actorId ?? '—'}</Td>
                  <Td>{formatDate(row.createdAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      {rows.length > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} / {totalPages} · {rows.length} records
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Hore
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Xiga
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
