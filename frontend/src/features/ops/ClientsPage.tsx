import { type FormEvent, type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientSchema, PERMISSIONS, type CreateClientInput } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { ApiError } from '../../lib/apiClient';
import { useClientsPage, useCreateClient } from './hooks';

const PAGE_SIZE = 20;

export function ClientsPage(): ReactNode {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const query = useClientsPage({ page, pageSize: PAGE_SIZE, search: search || undefined });
  const create = useCreateClient();
  const canCreate = useHasPermission(PERMISSIONS.CLIENTS_CREATE);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { companyName: '', status: 'ACTIVE' },
  });
  const rows = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submitSearch = (event: FormEvent): void => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await create.mutateAsync(values);
      form.reset();
      setOpen(false);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Clients</h1>
          <p className="mt-1 text-base text-muted">Client companies with portal access.</p>
        </div>
        {canCreate ? <Button onClick={() => setOpen(true)}>New client</Button> : null}
      </div>
      <form onSubmit={submitSearch} className="mt-6 flex max-w-md gap-2">
        <Input
          placeholder="Search companies…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Search clients"
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
          <ErrorState description="Could not load clients." onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No clients"
            action={canCreate ? <Button onClick={() => setOpen(true)}>New client</Button> : null}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Company</Th>
                <Th>Email</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Link
                      to={`/clients/${row.id}`}
                      className="font-medium text-ink hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {row.companyName}
                    </Link>
                  </Td>
                  <Td>{row.email ?? '—'}</Td>
                  <Td>
                    <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      {total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} / {totalPages} · {total} clients
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
      <Modal open={open} onClose={() => setOpen(false)} title="New client">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Company name"
            error={form.formState.errors.companyName?.message}
            {...form.register('companyName')}
          />
          <Input label="Email" type="email" {...form.register('email')} />
          <Input label="Phone" {...form.register('phone')} />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting || create.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
