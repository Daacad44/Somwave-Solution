import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createEmployeeSchema,
  EMPLOYEE_STATUS_LABELS,
  PERMISSIONS,
  type CreateEmployeeInput,
} from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DatePicker } from '../../components/ui/DatePicker';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { ApiError } from '../../lib/apiClient';
import { useCreateEmployee, useEmployeeCandidates, useEmployees } from './hooks';

const PAGE_SIZE = 20;

export function EmployeesPage(): ReactNode {
  const query = useEmployees();
  const create = useCreateEmployee();
  const canCreate = useHasPermission(PERMISSIONS.EMPLOYEES_CREATE);
  const candidates = useEmployeeCandidates(canCreate);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: { userId: '', employeeNo: '', position: '', department: '', hiredAt: '' },
  });
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? []).filter((row) => {
      if (!q) return true;
      return [row.user.name, row.user.email, row.employeeNo, row.position, row.department]
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

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await create.mutateAsync(values);
      form.reset({ userId: '', employeeNo: '', position: '', department: '', hiredAt: '' });
      setOpen(false);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Wax baa qaldamay.');
    }
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Shaqaalaha</h1>
          <p className="mt-1 text-base text-muted">Diiwaanka shaqaalaha gudaha.</p>
        </div>
        {canCreate ? <Button onClick={() => setOpen(true)}>Shaqaale cusub</Button> : null}
      </div>
      <form onSubmit={onSearch} className="mt-6 flex max-w-md gap-2">
        <Input
          placeholder="Raadi magac, lambarka, ama waaxda…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Raadi shaqaalaha"
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
            description="Shaqaalaha lama soo rari karin."
            onRetry={() => query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Shaqaale majiro"
            action={
              canCreate ? <Button onClick={() => setOpen(true)}>Shaqaale cusub</Button> : null
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Magaca</Th>
                <Th>Lambarka</Th>
                <Th>Jagada</Th>
                <Th>Waaxda</Th>
                <Th>Shaqo-gal</Th>
                <Th>Xaalad</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.user.name}</Td>
                  <Td>{row.employeeNo}</Td>
                  <Td>{row.position ?? '—'}</Td>
                  <Td>{row.department ?? '—'}</Td>
                  <Td>{formatDate(row.hiredAt)}</Td>
                  <Td>
                    <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {EMPLOYEE_STATUS_LABELS[row.status]}
                    </Badge>
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
            Bogga {page} / {totalPages} · {rows.length} shaqaale
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Hore
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Xiga
            </Button>
          </div>
        </div>
      ) : null}
      <Modal open={open} onClose={() => setOpen(false)} title="Shaqaale cusub">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Select
            label="Isticmaalaha"
            options={[
              { value: '', label: 'Dooro isticmaale' },
              ...(candidates.data ?? []).map((user) => ({
                value: user.id,
                label: `${user.name} (${user.email})`,
              })),
            ]}
            error={form.formState.errors.userId?.message}
            {...form.register('userId')}
          />
          <Input
            label="Lambarka shaqaalaha"
            error={form.formState.errors.employeeNo?.message}
            {...form.register('employeeNo')}
          />
          <Input label="Jagada" {...form.register('position')} />
          <Input label="Waaxda" {...form.register('department')} />
          <DatePicker label="Taariikhda shaqo-galka" {...form.register('hiredAt')} />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Jooji
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting || create.isPending}>
              Abuur
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
