import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { PERMISSIONS } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { fileToBase64 } from '../../lib/file';
import { ApiError } from '../../lib/apiClient';
import { useCreateMedia, useDeleteMedia, useDownloadMedia, useMedia } from './hooks';

export function MediaPage(): ReactNode {
  const query = useMedia();
  const create = useCreateMedia();
  const del = useDeleteMedia();
  const download = useDownloadMedia();
  const canCreate = useHasPermission(PERMISSIONS.MEDIA_CREATE);
  const canDelete = useHasPermission(PERMISSIONS.MEDIA_DELETE);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [fileName, setFileName] = useState('');
  const [alt, setAlt] = useState('');
  const [collection, setCollection] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; fileName: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? []).filter((row) => {
      if (!q) return true;
      return [row.fileName, row.alt, row.collection]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [query.data, search]);

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!file) {
      setServerError('A file is required.');
      return;
    }
    setServerError(null);
    try {
      await create.mutateAsync({
        fileName: fileName.trim() || file.name,
        mimeType: file.type || 'image/jpeg',
        contentBase64: await fileToBase64(file),
        alt: alt || undefined,
        collection: collection || undefined,
      });
      setFileName('');
      setAlt('');
      setCollection('');
      setFile(null);
      setOpen(false);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Maktabadda warbaahinta</h1>
          <p className="mt-1 text-base text-muted">Images and files used by the CMS.</p>
        </div>
        {canCreate ? <Button onClick={() => setOpen(true)}>Upload</Button> : null}
      </div>
      <form onSubmit={(e) => e.preventDefault()} className="mt-6 flex max-w-md gap-2">
        <Input
          placeholder="Search name, alt text, or collection…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search media"
          className="flex-1"
        />
      </form>
      <div className="mt-6">
        {query.isLoading ? (
          <div className="rounded-lg border border-border bg-surface">
            <LoadingState rows={6} label="Loading" />
          </div>
        ) : query.isError ? (
          <div className="rounded-lg border border-border bg-surface">
            <ErrorState description="Could not load media." onRetry={() => query.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState
              title="Warbaahin majirto"
              action={canCreate ? <Button onClick={() => setOpen(true)}>Upload</Button> : null}
            />
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-border bg-surface p-4">
                <p className="font-medium text-ink">{row.fileName}</p>
                <p className="mt-1 text-sm text-muted">{row.alt ?? 'No alt text'}</p>
                <p className="mt-1 text-sm text-muted">
                  {row.collection ?? 'Urur la’aan'} · {formatDate(row.createdAt)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => download.mutate({ id: row.id, fileName: row.fileName })}
                  >
                    Download
                  </Button>
                  {canDelete ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirming({ id: row.id, fileName: row.fileName })}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Upload media">
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          <Input label="File name" value={fileName} onChange={(e) => setFileName(e.target.value)} />
          <Input label="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} />
          <Input
            label="Ururka"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          />
          <Input
            label="File (JPG, PNG, PDF · 25 MB)"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={create.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Delete media">
        <p className="text-base text-ink">
          Delete <strong>{confirming?.fileName}</strong>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Cancel
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
            Yes, delete
          </Button>
        </div>
      </Modal>
    </section>
  );
}
