import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { fileToBase64 } from '../../lib/file';
import { ApiError } from '../../lib/apiClient';
import { useClients } from './hooks';
import { useCreateDocument, useDeleteDocument, useDocuments, useDownloadDocument } from './hooks';

const PAGE_SIZE = 20;

export function DocumentsPage(): ReactNode {
  const query = useDocuments();
  const create = useCreateDocument();
  const del = useDeleteDocument();
  const download = useDownloadDocument();
  const canCreate = useHasPermission(PERMISSIONS.DOCUMENTS_CREATE);
  const canDelete = useHasPermission(PERMISSIONS.DOCUMENTS_DELETE);
  const canPickClient = useHasPermission(PERMISSIONS.CLIENTS_READ);
  const clients = useClients({ enabled: canPickClient });
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<{ id: string; title: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? []).filter((row) => !q || row.title.toLowerCase().includes(q));
  }, [query.data, search]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!file) {
      setServerError('Faylka waa waajib.');
      return;
    }
    setServerError(null);
    try {
      await create.mutateAsync({
        title: title.trim() || file.name,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        contentBase64: await fileToBase64(file),
        clientId: clientId || undefined,
      });
      setTitle('');
      setClientId('');
      setFile(null);
      setOpen(false);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Wax baa qaldamay.');
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dukumeentiyada</h1>
          <p className="mt-1 text-base text-muted">Faylasha la oggol yahay, kayd ammaan ah.</p>
        </div>
        {canCreate ? <Button onClick={() => setOpen(true)}>Soo rar</Button> : null}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
        }}
        className="mt-6 flex max-w-md gap-2"
      >
        <Input
          placeholder="Raadi cinwaan…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Raadi dukumeentiyada"
          className="flex-1"
        />
        <Button type="submit" variant="secondary">
          Raadi
        </Button>
      </form>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState
            description="Dukumeentiyada lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Dukumeenti majiro"
            action={canCreate ? <Button onClick={() => setOpen(true)}>Soo rar</Button> : null}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cinwaan</Th>
                <Th>Nooca</Th>
                <Th>Cabbir</Th>
                <Th>Taariikh</Th>
                <Th className="text-end">Ficil</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.title}</Td>
                  <Td>{row.mimeType}</Td>
                  <Td>{Math.round(row.sizeBytes / 1024)} KB</Td>
                  <Td>{formatDate(row.createdAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => download.mutate({ id: row.id, fileName: row.title })}
                      >
                        Soo deji
                      </Button>
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setConfirming({ id: row.id, title: row.title })}
                        >
                          Tirtir
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      {rows.length > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Bogga {page} / {totalPages} · {rows.length} dukumeenti
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
      <Modal open={open} onClose={() => setOpen(false)} title="Soo rar dukumeenti">
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          <Input label="Cinwaan" value={title} onChange={(e) => setTitle(e.target.value)} />
          {canPickClient ? (
            <Select
              label="Macmiil"
              options={[
                { value: '', label: 'Gudaha / dhammaan' },
                ...(clients.data ?? []).map((row) => ({ value: row.id, label: row.companyName })),
              ]}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          ) : null}
          <Input
            label="Fayl (PDF, JPG, PNG · 25MB)"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Jooji
            </Button>
            <Button type="submit" isLoading={create.isPending}>
              Kaydi
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Tirtir dukumeentiga"
      >
        <p className="text-base text-ink">
          Ma tirtiraysaa <strong>{confirming?.title}</strong>? Lama soo celin karo.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Maya
          </Button>
          <Button
            variant="danger"
            isLoading={del.isPending}
            onClick={async () => {
              if (!confirming) return;
              await del.mutateAsync(confirming.id);
              setConfirming(null);
            }}
          >
            Haa, tirtir
          </Button>
        </div>
      </Modal>
    </section>
  );
}
