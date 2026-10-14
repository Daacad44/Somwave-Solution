import { type FormEvent, type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS } from '@somwave/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../../components/states';
import { useHasPermission } from '../../../lib/rbac';
import { projectFinanceApi } from '../api';

export function ProjectBudgetPanel({ projectId }: { projectId: string }): ReactNode {
  const client = useQueryClient();
  const canEdit = useHasPermission(PERMISSIONS.INVOICES_UPDATE);
  const [kind, setKind] = useState<'PLANNED' | 'ACTUAL'>('PLANNED');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [budget, setBudget] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['project-finance', projectId],
    queryFn: () => projectFinanceApi.get(projectId),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['project-finance', projectId] });
    void client.invalidateQueries({ queryKey: ['projects'] });
  };
  const create = useMutation({
    mutationFn: () =>
      projectFinanceApi.createExpense(projectId, {
        kind,
        category,
        description,
        amount,
        ...(expenseDate ? { expenseDate: new Date(expenseDate).toISOString() } : {}),
      }),
    onSuccess: () => {
      setCategory('');
      setDescription('');
      setAmount('');
      setExpenseDate('');
      setMessage('Expense recorded.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => projectFinanceApi.removeExpense(projectId, id),
    onSuccess: () => {
      setMessage('Expense removed.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const revise = useMutation({
    mutationFn: () => projectFinanceApi.reviseBudget(projectId, { budget, reason }),
    onSuccess: () => {
      setBudget('');
      setReason('');
      setMessage('Budget revised.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  if (query.isLoading) return <LoadingState rows={5} />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        description="Could not load project finance."
        onRetry={() => void query.refetch()}
      />
    );
  const finance = query.data;
  return (
    <div className="space-y-5">
      {message ? (
        <p role="status" className="rounded-md border border-border bg-surface p-3 text-sm">
          {message}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ['Original budget', finance.originalBudget],
            ['Current budget', finance.currentBudget],
            ['Planned expenses', finance.plannedExpenses],
            ['Actual expenses', finance.actualExpenses],
            [
              'Utilization',
              finance.utilizationPercent === null ? null : `${finance.utilizationPercent}%`,
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-xl font-semibold">
              {value === null ? '—' : label === 'Utilization' ? value : `$${value}`}
            </p>
          </div>
        ))}
      </div>
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Expense categories</h2>
        {finance.categories.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {finance.categories.map((row) => (
              <li
                key={row.category}
                className="flex flex-wrap justify-between gap-2 border-b border-border pb-2"
              >
                <strong>{row.category}</strong>
                <span>
                  Planned ${row.planned} · Actual ${row.actual}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No expenses recorded" />
        )}
      </section>
      {canEdit ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <form
            className="space-y-3 rounded-lg border border-border bg-surface p-5"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">Record expense</h2>
            <label className="block text-sm font-medium">
              Kind
              <select
                className="mt-1 h-11 w-full rounded border border-border bg-surface px-3"
                value={kind}
                onChange={(event) => setKind(event.target.value as 'PLANNED' | 'ACTUAL')}
              >
                <option value="PLANNED">Planned</option>
                <option value="ACTUAL">Actual</option>
              </select>
            </label>
            <Input
              label="Category"
              required
              maxLength={100}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
            <Input
              label="Description"
              required
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Input
              label="Amount (USD)"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <Input
              label="Expense date"
              type="date"
              value={expenseDate}
              onChange={(event) => setExpenseDate(event.target.value)}
            />
            <Button type="submit" disabled={create.isPending}>
              Record expense
            </Button>
          </form>
          <form
            className="space-y-3 rounded-lg border border-border bg-surface p-5"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              revise.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">Revise budget</h2>
            <Input
              label="New budget (USD)"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
            <Input
              label="Reason for change"
              required
              minLength={3}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <Button type="submit" disabled={revise.isPending}>
              Save revision
            </Button>
          </form>
        </div>
      ) : null}
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Expense history</h2>
        {finance.expenses.length ? (
          <ul className="mt-3 divide-y divide-border text-sm">
            {finance.expenses.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  {row.kind === 'PLANNED' ? 'Planned' : 'Actual'} · {row.category} ·{' '}
                  {row.description} · ${row.amount} ·{' '}
                  {new Date(row.expenseDate || row.createdAt).toLocaleDateString()}
                </span>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(row.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No expense entries" />
        )}
      </section>
      {finance.revisions.length ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Budget change history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {finance.revisions.map((row) => (
              <li key={row.id}>
                {new Date(row.createdAt).toLocaleString()} · ${row.previousBudget ?? '—'} → $
                {row.newBudget} · {row.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
