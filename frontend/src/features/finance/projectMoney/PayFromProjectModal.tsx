// Pay money out of one project directly from Finance. Creates an expense
// finance transaction already linked to the project (and its client), so it
// follows the existing approval → posting workflow and lands in the ledger with
// the project dimension. The form shows the budget impact before saving.
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import {
  PERMISSIONS,
  PROJECT_PAYMENT_METHODS,
  PROJECT_SPEND_CATEGORIES,
  createFinanceTransactionSchema,
  financeBusinessDate,
  type FinanceAccountRecord,
} from '@somwave/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { LoadingState } from '../../../components/states';
import { useHasPermission } from '../../../lib/rbac';
import { financeApi } from '../api';
import { formatMoney } from './format';

export interface PayTarget {
  projectId: string;
  projectName: string;
  clientId: string | null;
  currency: string;
  budget: string | null;
  spent: string;
  pendingSpend: string;
  members?: { userId: string; name: string; role: string }[];
}

const STANDARD_ACCOUNTS = [
  { code: '1000', name: 'Cash on hand', type: 'ASSET' },
  { code: '1010', name: 'EVC Plus wallet', type: 'ASSET' },
  { code: '1020', name: 'Bank account', type: 'ASSET' },
  { code: '5100', name: 'Project direct costs', type: 'DIRECT_COST' },
] as const;

const METHOD_ACCOUNT_HINT: Record<string, string> = {
  'EVC Plus': 'EVC',
  'Bank transfer': 'BANK',
  Cash: 'CASH',
};

function usable(account: FinanceAccountRecord, currency: string): boolean {
  return (
    account.isActive && account.allowPosting && (!account.currency || account.currency === currency)
  );
}

function businessDateToIso(date: string): string {
  // Midday in Mogadishu keeps the business date stable across time zones.
  return `${date}T12:00:00+03:00`;
}

export function PayFromProjectModal({
  target,
  onClose,
  onDone,
}: {
  target: PayTarget | null;
  onClose: () => void;
  onDone?: (message: string) => void;
}): ReactNode {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSIONS.FINANCE_MANAGE);
  const accounts = useQuery({
    queryKey: ['finance-accounts'],
    queryFn: financeApi.accounts,
    enabled: target !== null,
  });
  const currency = target?.currency ?? 'USD';
  const [category, setCategory] = useState<string>(PROJECT_SPEND_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(financeBusinessDate);
  const [method, setMethod] = useState<string>(PROJECT_PAYMENT_METHODS[0]);
  const [reference, setReference] = useState('');
  const [cashAccountId, setCashAccountId] = useState('');
  const [costAccountId, setCostAccountId] = useState('');
  const [submitNow, setSubmitNow] = useState(true);
  const [error, setError] = useState('');

  const cashAccounts = useMemo(
    () => (accounts.data ?? []).filter((a) => a.type === 'ASSET' && usable(a, currency)),
    [accounts.data, currency],
  );
  const costAccounts = useMemo(
    () =>
      (accounts.data ?? [])
        .filter((a) => (a.type === 'DIRECT_COST' || a.type === 'EXPENSE') && usable(a, currency))
        .sort((a, b) =>
          a.type === b.type ? a.code.localeCompare(b.code) : a.type === 'DIRECT_COST' ? -1 : 1,
        ),
    [accounts.data, currency],
  );

  // Reset the form each time a project is chosen.
  useEffect(() => {
    if (!target) return;
    setCategory(PROJECT_SPEND_CATEGORIES[0]);
    setCustomCategory('');
    setDescription('');
    setPayee('');
    setAmount('');
    setDate(financeBusinessDate());
    setMethod(PROJECT_PAYMENT_METHODS[0]);
    setReference('');
    setSubmitNow(true);
    setError('');
  }, [target]);

  // Pick the paying account that matches the payment method, then the first direct-cost account.
  useEffect(() => {
    const hint = METHOD_ACCOUNT_HINT[method];
    const match = hint
      ? cashAccounts.find(
          (a) => a.name.toUpperCase().includes(hint) || a.code.toUpperCase().includes(hint),
        )
      : undefined;
    setCashAccountId((current) =>
      match
        ? match.id
        : cashAccounts.some((a) => a.id === current)
          ? current
          : (cashAccounts[0]?.id ?? ''),
    );
  }, [method, cashAccounts]);
  useEffect(() => {
    setCostAccountId((current) =>
      costAccounts.some((a) => a.id === current) ? current : (costAccounts[0]?.id ?? ''),
    );
  }, [costAccounts]);

  const setupAccounts = useMutation({
    mutationFn: async () => {
      const existing = new Set((accounts.data ?? []).map((a) => a.code));
      for (const account of STANDARD_ACCOUNTS) {
        if (existing.has(account.code)) continue;
        await financeApi.createAccount({ ...account, currency: null, allowPosting: true });
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['finance-accounts'] }),
    onError: (err: Error) => setError(err.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const finalCategory = category === 'Other' ? customCategory.trim() || 'Other' : category;
      const payload = createFinanceTransactionSchema.parse({
        type: 'EXPENSE',
        amount: amount.trim(),
        currency,
        category: finalCategory,
        description: description.trim(),
        occurredOn: businessDateToIso(date),
        cashAccountId,
        offsetAccountId: costAccountId,
        paymentMethod: method,
        externalRef: reference.trim() || null,
        counterparty: payee.trim() || null,
        projectId: target!.projectId,
        clientId: target!.clientId,
      });
      const created = await financeApi.createTransaction(payload);
      if (submitNow) await financeApi.action(created.id, 'submit');
      return created;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance-project-money'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-projects-money'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] }),
      ]);
      onDone?.(
        submitNow
          ? `Payment of ${formatMoney(amount, currency)} sent for approval.`
          : `Payment of ${formatMoney(amount, currency)} saved as a draft.`,
      );
      onClose();
    },
    onError: (err: unknown) => {
      if (err && typeof err === 'object' && 'issues' in err) {
        const issues = (err as { issues: { path: (string | number)[]; message: string }[] }).issues;
        setError(
          issues.map((issue) => `${issue.path.join('.') || 'Form'}: ${issue.message}`).join(' · '),
        );
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not save the payment.');
    },
  });

  if (!target) return null;

  const budget = target.budget === null ? null : Number(target.budget);
  const committed = Number(target.spent) + Number(target.pendingSpend);
  const value = Number(amount) || 0;
  const after = committed + value;
  const remainingAfter = budget === null ? null : budget - after;
  const overBudget = remainingAfter !== null && remainingAfter < 0;
  const needsAccounts =
    !accounts.isLoading && (cashAccounts.length === 0 || costAccounts.length === 0);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (category === 'Other' && !customCategory.trim()) {
      setError('Describe what kind of work or cost this is.');
      return;
    }
    save.mutate();
  };

  return (
    <Modal open onClose={onClose} title={`Pay from ${target.projectName}`} wide>
      {accounts.isLoading ? (
        <LoadingState rows={3} />
      ) : needsAccounts ? (
        <div className="space-y-3 text-sm">
          <p className="text-ink">
            Before paying from a project, Finance needs an account the money is paid{' '}
            <strong>from</strong> (cash, EVC Plus or bank) and an account it is charged{' '}
            <strong>to</strong> (project direct costs).
          </p>
          {canManage ? (
            <>
              <p className="text-muted">
                Create the standard accounts: 1000 Cash on hand, 1010 EVC Plus wallet, 1020 Bank
                account, 5100 Project direct costs. You can rename or add more later in Chart of
                Accounts.
              </p>
              <Button onClick={() => setupAccounts.mutate()} isLoading={setupAccounts.isPending}>
                Create standard accounts
              </Button>
            </>
          ) : (
            <p className="text-muted">
              Ask a finance administrator to create them in Chart of Accounts.
            </p>
          )}
          {error ? <p className="text-error">{error}</p> : null}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="What is this payment for?"
              value={category}
              options={PROJECT_SPEND_CATEGORIES.map((value) => ({ value, label: value }))}
              onChange={(event) => setCategory(event.target.value)}
            />
            {category === 'Other' ? (
              <Input
                label="Type of work or cost"
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                maxLength={100}
                required
              />
            ) : (
              <div className="hidden sm:block" />
            )}
            <Input
              label="Description"
              placeholder="e.g. Booking API — milestone 2"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={3}
              maxLength={2000}
              required
            />
            <Input
              label="Paid to"
              placeholder="Engineer, contractor or vendor"
              list="pay-from-project-members"
              value={payee}
              onChange={(event) => setPayee(event.target.value)}
              maxLength={200}
            />
            <datalist id="pay-from-project-members">
              {(target.members ?? []).map((member) => (
                <option key={member.userId} value={member.name} />
              ))}
            </datalist>
            <Input
              label={`Amount (${currency})`}
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            <Input
              type="date"
              label="Payment date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
            <Select
              label="Payment method"
              value={method}
              options={PROJECT_PAYMENT_METHODS.map((value) => ({ value, label: value }))}
              onChange={(event) => setMethod(event.target.value)}
            />
            <Input
              label="Reference (optional)"
              placeholder="EVC transaction ID, bank ref…"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={120}
            />
            <Select
              label="Paid from account"
              value={cashAccountId}
              options={cashAccounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
              onChange={(event) => setCashAccountId(event.target.value)}
            />
            <Select
              label="Charged to account"
              value={costAccountId}
              options={costAccounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
              onChange={(event) => setCostAccountId(event.target.value)}
            />
          </div>

          <div
            className={
              overBudget
                ? 'rounded-md border border-error bg-surface-alt p-3 text-sm'
                : 'rounded-md border border-border bg-surface-alt p-3 text-sm'
            }
          >
            <p className="font-medium text-ink">Budget impact</p>
            {budget === null ? (
              <p className="mt-1 text-muted">
                This project has no budget. Already spent or awaiting approval:{' '}
                {formatMoney(committed.toFixed(2), currency)}.
              </p>
            ) : (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                <dt className="text-muted">Budget</dt>
                <dd className="tabular-nums">{formatMoney(budget.toFixed(2), currency)}</dd>
                <dt className="text-muted">Spent + pending</dt>
                <dd className="tabular-nums">{formatMoney(committed.toFixed(2), currency)}</dd>
                <dt className="text-muted">This payment</dt>
                <dd className="tabular-nums">{formatMoney(value.toFixed(2), currency)}</dd>
                <dt className="text-muted">Left after</dt>
                <dd
                  className={
                    overBudget
                      ? 'font-semibold text-error tabular-nums'
                      : 'font-semibold tabular-nums'
                  }
                >
                  {formatMoney(remainingAfter!.toFixed(2), currency)}
                </dd>
              </dl>
            )}
            {overBudget ? (
              <p className="mt-2 flex items-center gap-1.5 font-medium text-error">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                This payment takes the project over budget. The approver will see this.
              </p>
            ) : null}
          </div>

          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={submitNow}
              onChange={(event) => setSubmitNow(event.target.checked)}
            />
            <span>
              Send for approval now
              <span className="block text-xs text-muted">
                A different finance user approves it, then it is posted to the ledger and counted as
                spent on this project.
              </span>
            </span>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={save.isPending}>
              {submitNow ? 'Save and send for approval' : 'Save as draft'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
