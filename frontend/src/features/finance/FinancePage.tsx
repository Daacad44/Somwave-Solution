import { type FormEvent, type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  PERMISSIONS,
  financeBusinessDate,
  parseFinanceBusinessDate,
  type CreateFinanceAccountInput,
  type CreateFinanceTransactionInput,
  type FinanceAccountRecord,
  type FinanceTransactionRecord,
} from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCurrentUser } from '../auth/hooks';
import {
  financeApi,
  type FinanceHistoryFilters,
  type FinanceJournalRecord,
  type JournalHistoryFilters,
  type TransactionHistoryFilters,
} from './api';
import { FinanceStepUp, financeAccessReason } from './FinanceStepUp';
import { ProjectMoneyOverview } from './projectMoney/ProjectMoneyOverview';

type Tab =
  'Overview' | 'Transactions' | 'Approvals' | 'Projects' | 'Chart of Accounts' | 'General Ledger';
const tabs: Tab[] = [
  'Overview',
  'Transactions',
  'Approvals',
  'Projects',
  'Chart of Accounts',
  'General Ledger',
];
const accountTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'DIRECT_COST', 'EXPENSE'] as const;
const HISTORY_PAGE_SIZE = 20;
const fieldClass =
  'h-11 w-full rounded-md border border-border bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
function today(): string {
  return financeBusinessDate();
}
function monthStart(): string {
  return `${today().slice(0, 7)}-01`;
}
function nextMonth(): string {
  const [year, month] = today().split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}
function money(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

export function FinancePage(): ReactNode {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab = tabs.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'Overview';
  const setTab = (next: Tab): void => {
    setSearchParams(next === 'Overview' ? {} : { tab: next }, { replace: true });
  };
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(nextMonth);
  const [message, setMessage] = useState('');
  const validRange = Boolean(
    parseFinanceBusinessDate(from) && parseFinanceBusinessDate(to) && from < to,
  );
  const [editing, setEditing] = useState<FinanceTransactionRecord | null>(null);
  const [transactionFilters, setTransactionFilters] = useState<TransactionHistoryFilters>({
    page: 1,
    pageSize: HISTORY_PAGE_SIZE,
  });
  const [approvalPage, setApprovalPage] = useState(1);
  const [journalFilters, setJournalFilters] = useState<JournalHistoryFilters>({
    page: 1,
    pageSize: HISTORY_PAGE_SIZE,
  });
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(PERMISSIONS.FINANCE_CREATE);
  const canApprove = useHasPermission(PERMISSIONS.FINANCE_APPROVE);
  const canPost = useHasPermission(PERMISSIONS.FINANCE_POST);
  const canManage = useHasPermission(PERMISSIONS.FINANCE_MANAGE);
  const { data: user } = useCurrentUser();
  const accounts = useQuery({ queryKey: ['finance-accounts'], queryFn: financeApi.accounts });
  const linkOptions = useQuery({
    queryKey: ['finance-link-options'],
    queryFn: financeApi.linkOptions,
  });
  const transactions = useQuery({
    queryKey: ['finance-transactions', tab, transactionFilters, approvalPage],
    queryFn: () =>
      financeApi.transactions({
        ...transactionFilters,
        page: tab === 'Approvals' ? approvalPage : transactionFilters.page,
        status: tab === 'Approvals' ? 'SUBMITTED,APPROVED' : transactionFilters.status,
      }),
    enabled:
      (tab === 'Transactions' || tab === 'Approvals') &&
      (!transactionFilters.from ||
        !transactionFilters.to ||
        transactionFilters.from < transactionFilters.to),
  });
  const dashboard = useQuery({
    queryKey: ['finance-dashboard', from, to],
    queryFn: () => financeApi.dashboard(from, to),
    enabled: validRange,
  });
  const trial = useQuery({
    queryKey: ['finance-trial', from, to],
    queryFn: () => financeApi.trialBalance(from, to),
    enabled: validRange && tab === 'General Ledger',
  });
  const projectProfitability = useQuery({
    queryKey: ['finance-project-profitability', from, to],
    queryFn: () => financeApi.projectProfitability(from, to),
    enabled: validRange && tab === 'Projects',
  });
  const journals = useQuery({
    queryKey: ['finance-journals', journalFilters],
    queryFn: () => financeApi.journals(journalFilters),
    enabled:
      tab === 'General Ledger' &&
      (!journalFilters.from || !journalFilters.to || journalFilters.from < journalFilters.to),
  });
  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['finance-accounts'] });
    void queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
    void queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['finance-trial'] });
    void queryClient.invalidateQueries({ queryKey: ['finance-project-profitability'] });
    void queryClient.invalidateQueries({ queryKey: ['finance-journals'] });
  };
  const action = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: 'submit' | 'approve' | 'reject' | 'post' | 'cancel';
      reason?: string;
    }) => financeApi.action(id, action, reason),
    onSuccess: (_row, vars) => {
      setMessage(`Transaction ${vars.action} completed.`);
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  // Every finance endpoint shares the 2FA gate; the dashboard query runs first.
  const accessReason = financeAccessReason(dashboard.error);
  if (accessReason) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-ink">Financial Management</h1>
        </header>
        <FinanceStepUp reason={accessReason} />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Financial Management</h1>
        <p className="mt-1 text-sm text-muted">
          Review, approve and post balanced accounting records.
        </p>
      </header>
      {message ? (
        <p role="status" className="rounded-md border border-border bg-surface p-3 text-sm">
          {message}
        </p>
      ) : null}
      <nav
        aria-label="Finance sections"
        className="flex gap-2 overflow-x-auto border-b border-border pb-2"
      >
        {tabs.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            aria-current={tab === name ? 'page' : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${tab === name ? 'bg-primary text-surface' : 'text-ink hover:bg-surface-alt'}`}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === 'Overview' ? (
        <ProjectMoneyOverview mode="summary" onOpenAll={() => setTab('Projects')} />
      ) : null}
      {tab === 'Projects' ? <ProjectMoneyOverview mode="full" /> : null}
      {tab === 'Overview' || tab === 'Projects' ? (
        <h2 className="border-t border-border pt-5 text-lg font-semibold text-ink">
          {tab === 'Projects'
            ? 'Ledger profitability (posted journals)'
            : 'Ledger (posted journals)'}
        </h2>
      ) : null}
      {(tab === 'Overview' || tab === 'General Ledger' || tab === 'Projects') && (
        <div className="flex flex-wrap items-end gap-3">
          <Input
            type="date"
            label="From (inclusive)"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Input
            type="date"
            label="To (exclusive)"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
          {!validRange ? (
            <p className="text-sm text-error">Select an end date after the start date.</p>
          ) : null}
        </div>
      )}
      <p className="text-sm text-muted">
        Date filters use Africa/Mogadishu (UTC+03:00). The end date is excluded.
      </p>
      {tab === 'Overview' &&
        validRange &&
        (dashboard.isLoading ? (
          <LoadingState rows={3} />
        ) : dashboard.isError || !dashboard.data ? (
          <ErrorState
            description={
              dashboard.error instanceof Error
                ? dashboard.error.message
                : 'Could not load finance dashboard.'
            }
            onRetry={() => void dashboard.refetch()}
          />
        ) : (
          <section className="space-y-4" aria-label="Posted journal overview">
            <p className="rounded-md border border-border bg-surface-alt p-3 text-sm text-muted">
              {dashboard.data.basis}
            </p>
            <p className="font-medium">
              Pending approvals in period: {dashboard.data.pendingApprovals}
            </p>
            {dashboard.data.accountBalances.length > 0 && (
              <section
                aria-label="Ledger account balances"
                className="overflow-x-auto rounded-md border border-border p-4"
              >
                <h2 className="font-semibold">Asset and liability balances at end date</h2>
                <table className="mt-3 w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Type</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.data.accountBalances.map((row) => (
                      <tr key={`${row.code}:${row.currency}`}>
                        <td>
                          {row.code} · {row.name}
                        </td>
                        <td>{row.type}</td>
                        <td>{money(row.balance, row.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {dashboard.data.currencies.length === 0 ? (
              <EmptyState
                title="No posted journals in this period"
                description="Create chart accounts and submit an income or expense for approval."
              />
            ) : (
              dashboard.data.currencies.map((row) => (
                <div key={row.currency} className="rounded-lg border border-border bg-surface p-5">
                  <h2 className="text-lg font-semibold">
                    {row.currency} ·{' '}
                    {row.balanced ? 'Ledger balanced' : 'Ledger imbalance — investigate'}
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ['Recognized revenue', row.revenue],
                      ['Recorded expenses', row.expenses],
                      ['Net profit', row.netProfit],
                      ['Journal debits / credits', `${row.debits} / ${row.credits}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md bg-surface-alt p-4">
                        <p className="text-sm text-muted">{label}</p>
                        <p className="mt-1 text-xl font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            {dashboard.data.trends.length > 0 && (
              <section
                aria-label="Financial trends"
                className="overflow-x-auto rounded-md border border-border p-4"
              >
                <h2 className="font-semibold">Monthly financial trends</h2>
                <table className="mt-3 w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Currency</th>
                      <th>Revenue</th>
                      <th>Expenses</th>
                      <th>Net profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.data.trends.map((row) => (
                      <tr key={`${row.month}:${row.currency}`}>
                        <td>{row.month}</td>
                        <td>{row.currency}</td>
                        <td>{row.revenue}</td>
                        <td>{row.expenses}</td>
                        <td>{row.netProfit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            <details className="text-sm text-muted">
              <summary>Accounting coverage</summary>
              <ul className="mt-2 list-disc pl-5">
                {dashboard.data.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
            <p className="text-sm text-muted">
              Amounts remain separate by currency. They are never added across USD, SOS or another
              currency without an approved exchange rate.
            </p>
          </section>
        ))}
      {tab === 'Transactions' && (
        <div className="space-y-6">
          {canCreate && (
            <TransactionForm
              key={editing?.id ?? 'new'}
              initial={editing}
              accounts={accounts.data ?? []}
              projects={linkOptions.data?.projects ?? []}
              clients={linkOptions.data?.clients ?? []}
              onDone={(text, success) => {
                setMessage(text);
                refresh();
                if (success) setEditing(null);
              }}
              onCancelEdit={() => setEditing(null)}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Status
              <select
                className={fieldClass}
                value={transactionFilters.status ?? ''}
                onChange={(event) =>
                  setTransactionFilters((current) => ({
                    ...current,
                    status: event.target.value || undefined,
                    page: 1,
                  }))
                }
              >
                <option value="">All statuses</option>
                {['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED'].map(
                  (status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-sm font-medium">
              Type
              <select
                className={fieldClass}
                value={transactionFilters.type ?? ''}
                onChange={(event) =>
                  setTransactionFilters((current) => ({
                    ...current,
                    type: (event.target.value || undefined) as TransactionHistoryFilters['type'],
                    page: 1,
                  }))
                }
              >
                <option value="">All types</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </label>
          </div>
          <FinanceHistoryFilters
            filters={transactionFilters}
            accounts={accounts.data ?? []}
            onChange={(patch) =>
              setTransactionFilters((current) => ({ ...current, ...patch, page: 1 }))
            }
            kind="transactions"
          />
          <TransactionList
            rows={transactions.data?.data ?? []}
            loading={transactions.isLoading}
            error={transactions.isError}
            userId={user?.id}
            canCreate={canCreate}
            canApprove={canApprove}
            canPost={canPost}
            action={action.mutate}
            onEdit={setEditing}
          />
          <HistoryPagination
            meta={transactions.data?.meta}
            onPage={(page) => setTransactionFilters((current) => ({ ...current, page }))}
          />
        </div>
      )}
      {tab === 'Approvals' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Submitted and approved transactions requiring action.
          </p>
          <TransactionList
            rows={transactions.data?.data ?? []}
            loading={transactions.isLoading}
            error={transactions.isError}
            userId={user?.id}
            canCreate={canCreate}
            canApprove={canApprove}
            canPost={canPost}
            action={action.mutate}
            onEdit={(row) => {
              setEditing(row);
              setTab('Transactions');
            }}
          />
          <HistoryPagination meta={transactions.data?.meta} onPage={setApprovalPage} />
        </div>
      )}
      {tab === 'Projects' && (
        <section className="space-y-3">
          <p className="text-sm text-muted">
            Direct project-linked posted journals only. Labor, shared overhead, legacy project
            expenses and invoices require separate reconciliation.
          </p>
          {projectProfitability.isLoading ? (
            <LoadingState rows={4} />
          ) : projectProfitability.isError ? (
            <ErrorState
              description="Could not load project profitability."
              onRetry={() => void projectProfitability.refetch()}
            />
          ) : !projectProfitability.data?.length ? (
            <EmptyState title="No project-linked posted entries in this period" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-surface-alt">
                  <tr>
                    <th className="p-3">Project</th>
                    <th className="p-3">Currency</th>
                    <th className="p-3 text-right">Revenue</th>
                    <th className="p-3 text-right">Direct costs</th>
                    <th className="p-3 text-right">Operating costs</th>
                    <th className="p-3 text-right">Gross profit</th>
                    <th className="p-3 text-right">Net profit</th>
                    <th className="p-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {projectProfitability.data.map((row) => (
                    <tr key={`${row.projectId}-${row.currency}`} className="border-t border-border">
                      <td className="p-3 font-medium">{row.projectName}</td>
                      <td className="p-3">{row.currency}</td>
                      <td className="p-3 text-right">{row.revenue}</td>
                      <td className="p-3 text-right">{row.directCosts}</td>
                      <td className="p-3 text-right">{row.operatingExpenses}</td>
                      <td className="p-3 text-right">{row.grossProfit}</td>
                      <td className="p-3 text-right">{row.netProfit}</td>
                      <td className="p-3 text-right">
                        {row.marginPercent === null ? '—' : `${row.marginPercent}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {tab === 'Chart of Accounts' && (
        <div className="space-y-6">
          {canManage && (
            <AccountForm
              onDone={(text) => {
                setMessage(text);
                refresh();
              }}
            />
          )}
          {accounts.isLoading ? (
            <LoadingState rows={5} />
          ) : accounts.isError ? (
            <ErrorState
              description="Could not load chart of accounts."
              onRetry={() => void accounts.refetch()}
            />
          ) : !accounts.data?.length ? (
            <EmptyState title="No accounts configured" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-surface-alt">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Currency</th>
                    <th className="p-3">Posting</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.data.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="p-3 font-medium">{row.code}</td>
                      <td className="p-3">{row.name}</td>
                      <td className="p-3">{row.type.replace('_', ' ')}</td>
                      <td className="p-3">{row.currency ?? 'All'}</td>
                      <td className="p-3">
                        {row.isActive && row.allowPosting ? 'Allowed' : 'Blocked'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab === 'General Ledger' && (
        <div className="space-y-6">
          {canManage && (
            <PeriodClosePanel
              onDone={(text) => {
                setMessage(text);
                refresh();
              }}
            />
          )}
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Period trial balance</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={from >= to}
                onClick={() =>
                  void financeApi
                    .downloadTrialBalance(from, to)
                    .catch((error: Error) => setMessage(error.message))
                }
              >
                Download CSV
              </Button>
            </div>
            {trial.isLoading ? (
              <LoadingState rows={4} />
            ) : trial.isError ? (
              <ErrorState
                description="Could not load trial balance."
                onRetry={() => void trial.refetch()}
              />
            ) : !trial.data?.length ? (
              <EmptyState title="No posted entries in this period" />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-surface-alt">
                    <tr>
                      <th className="p-3">Code</th>
                      <th className="p-3">Account</th>
                      <th className="p-3">Currency</th>
                      <th className="p-3 text-right">Debit</th>
                      <th className="p-3 text-right">Credit</th>
                      <th className="p-3 text-right">Net debit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trial.data.map((row) => (
                      <tr key={`${row.code}-${row.currency}`} className="border-t border-border">
                        <td className="p-3">{row.code}</td>
                        <td className="p-3">{row.name}</td>
                        <td className="p-3">{row.currency}</td>
                        <td className="p-3 text-right">{row.debit}</td>
                        <td className="p-3 text-right">{row.credit}</td>
                        <td className="p-3 text-right">{row.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Posted journal history</h2>
            <label className="mb-3 block text-sm font-medium">
              Source
              <select
                className={fieldClass}
                value={journalFilters.sourceType ?? ''}
                onChange={(event) =>
                  setJournalFilters((current) => ({
                    ...current,
                    sourceType: (event.target.value ||
                      undefined) as JournalHistoryFilters['sourceType'],
                    page: 1,
                  }))
                }
              >
                <option value="">All sources</option>
                <option value="FINANCE_TRANSACTION">Finance transaction</option>
                <option value="REVERSAL">Reversal</option>
              </select>
            </label>
            <FinanceHistoryFilters
              filters={journalFilters}
              accounts={accounts.data ?? []}
              onChange={(patch) =>
                setJournalFilters((current) => ({ ...current, ...patch, page: 1 }))
              }
              kind="journals"
            />
            {journals.isLoading ? (
              <LoadingState rows={4} />
            ) : journals.isError ? (
              <ErrorState
                description="Could not load journals."
                onRetry={() => void journals.refetch()}
              />
            ) : !journals.data?.data.length ? (
              <EmptyState title="No posted journals yet" />
            ) : (
              <ul className="space-y-3">
                {journals.data.data.map((row) => (
                  <JournalCard
                    key={row.id}
                    row={row}
                    canManage={canManage}
                    onDone={(text) => {
                      setMessage(text);
                      refresh();
                    }}
                  />
                ))}
              </ul>
            )}
            <HistoryPagination
              meta={journals.data?.meta}
              onPage={(page) => setJournalFilters((current) => ({ ...current, page }))}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function PeriodClosePanel({ onDone }: { onDone: (message: string) => void }): ReactNode {
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [confirmation, setConfirmation] = useState('');
  const close = useMutation({
    mutationFn: () =>
      financeApi.closePeriod(Number(period.slice(0, 4)), Number(period.slice(5, 7))),
    onSuccess: () => {
      setConfirmation('');
      onDone(`Accounting period ${period} closed.`);
    },
    onError: (error: Error) => onDone(error.message),
  });
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">Close an accounting period</h2>
      <p className="mt-1 text-sm text-muted">
        Closing prevents new income, expenses and journals dated in that month. Resolve submitted
        and approved transactions first.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Input
          label="Month"
          type="month"
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value);
            setConfirmation('');
          }}
        />
        <Input
          label={`Type CLOSE ${period} to confirm`}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <Button
          type="button"
          variant="danger"
          disabled={confirmation !== `CLOSE ${period}`}
          isLoading={close.isPending}
          onClick={() => close.mutate()}
        >
          Close period
        </Button>
      </div>
    </section>
  );
}

function AccountForm({ onDone }: { onDone: (message: string) => void }): ReactNode {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<CreateFinanceAccountInput['type']>('ASSET');
  const [currency, setCurrency] = useState('');
  const create = useMutation({
    mutationFn: () =>
      financeApi.createAccount({
        code,
        name,
        type,
        currency: currency || null,
        allowPosting: true,
      }),
    onSuccess: () => {
      setCode('');
      setName('');
      onDone('Account created.');
    },
    onError: (error: Error) => onDone(error.message),
  });
  function submit(event: FormEvent): void {
    event.preventDefault();
    create.mutate();
  }
  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">New account</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Account code"
          value={code}
          required
          onChange={(event) => setCode(event.target.value.toUpperCase())}
        />
        <Input
          label="Account name"
          value={name}
          required
          onChange={(event) => setName(event.target.value)}
        />
        <label className="text-sm font-medium">
          Type
          <select
            className={fieldClass}
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            {accountTypes.map((item) => (
              <option key={item} value={item}>
                {item.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Currency (optional)"
          maxLength={3}
          value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          placeholder="USD, SOS or blank"
        />
      </div>
      <Button type="submit" className="mt-4" isLoading={create.isPending}>
        Create account
      </Button>
    </form>
  );
}

function TransactionForm({
  initial,
  accounts,
  projects,
  clients,
  onDone,
  onCancelEdit,
}: {
  initial: FinanceTransactionRecord | null;
  accounts: FinanceAccountRecord[];
  projects: { id: string; name: string; clientId: string | null }[];
  clients: { id: string; companyName: string }[];
  onDone: (message: string, success: boolean) => void;
  onCancelEdit: () => void;
}): ReactNode {
  const [type, setType] = useState<CreateFinanceTransactionInput['type']>(
    initial?.type ?? 'EXPENSE',
  );
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(
    initial ? financeBusinessDate(new Date(initial.occurredOn)) : today(),
  );
  const [cashAccountId, setCashAccountId] = useState(initial?.cashAccountId ?? '');
  const [offsetAccountId, setOffsetAccountId] = useState(initial?.offsetAccountId ?? '');
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? '');
  const [externalRef, setExternalRef] = useState(initial?.externalRef ?? '');
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? '');
  const [projectId, setProjectId] = useState(initial?.projectId ?? '');
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const cashAccounts = accounts.filter(
    (account) =>
      account.type === 'ASSET' &&
      account.isActive &&
      account.allowPosting &&
      (!account.currency || account.currency === currency),
  );
  const offsetAccounts = accounts.filter(
    (account) =>
      account.isActive &&
      account.allowPosting &&
      (!account.currency || account.currency === currency) &&
      (type === 'INCOME'
        ? account.type === 'REVENUE'
        : account.type === 'EXPENSE' || account.type === 'DIRECT_COST'),
  );
  const create = useMutation({
    mutationFn: () => {
      const payload: CreateFinanceTransactionInput = {
        type,
        amount,
        currency,
        category,
        description,
        occurredOn:
          initial && financeBusinessDate(new Date(initial.occurredOn)) === date
            ? initial.occurredOn
            : parseFinanceBusinessDate(date)!.toISOString(),
        cashAccountId,
        offsetAccountId,
        paymentMethod: paymentMethod || null,
        externalRef: externalRef || null,
        counterparty: counterparty || null,
        projectId: projectId || null,
        clientId: clientId || null,
      };
      return initial
        ? financeApi.updateTransaction(initial.id, payload)
        : financeApi.createTransaction(payload);
    },
    onSuccess: () => {
      setAmount('');
      setCategory('');
      setDescription('');
      setExternalRef('');
      setCounterparty('');
      onDone(
        initial
          ? 'Draft changes saved.'
          : 'Draft transaction created. Submit it for independent approval before posting.',
        true,
      );
    },
    onError: (error: Error) => onDone(error.message, false),
  });
  function submit(event: FormEvent): void {
    event.preventDefault();
    create.mutate();
  }
  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">
        {initial ? 'Edit draft transaction' : 'New income or expense'}
      </h2>
      <p className="mt-1 text-sm text-muted">
        For direct cash activity only. Existing invoice payments are separate until reconciled;
        recording a draft does not verify external funds.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">
          Type
          <select
            className={fieldClass}
            value={type}
            onChange={(event) => {
              setType(event.target.value as typeof type);
              setOffsetAccountId('');
            }}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </label>
        <Input
          label="Amount"
          inputMode="decimal"
          value={amount}
          required
          onChange={(event) => setAmount(event.target.value)}
        />
        <Input
          label="Currency"
          maxLength={3}
          value={currency}
          required
          onChange={(event) => {
            setCurrency(event.target.value.toUpperCase());
            setCashAccountId('');
            setOffsetAccountId('');
          }}
        />
        <Input
          label="Category"
          value={category}
          required
          onChange={(event) => setCategory(event.target.value)}
        />
        <Input
          label="Description"
          value={description}
          required
          onChange={(event) => setDescription(event.target.value)}
        />
        <Input
          label="Accounting date"
          type="date"
          value={date}
          required
          onChange={(event) => setDate(event.target.value)}
        />
        <label className="text-sm font-medium">
          Cash or bank account
          <select
            className={fieldClass}
            value={cashAccountId}
            required
            onChange={(event) => setCashAccountId(event.target.value)}
          >
            <option value="">Select an asset account</option>
            {cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} · {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {type === 'INCOME' ? 'Revenue account' : 'Expense account'}
          <select
            className={fieldClass}
            value={offsetAccountId}
            required
            onChange={(event) => setOffsetAccountId(event.target.value)}
          >
            <option value="">Select an account</option>
            {offsetAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} · {account.name}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="External reference (optional)"
          value={externalRef}
          onChange={(event) => setExternalRef(event.target.value)}
        />
        <Input
          label="Payment method (optional)"
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value)}
        />
        <Input
          label="Counterparty (optional)"
          value={counterparty}
          onChange={(event) => setCounterparty(event.target.value)}
        />
        <label className="text-sm font-medium">
          Project (optional)
          <select
            className={fieldClass}
            value={projectId}
            onChange={(event) => {
              const next = projects.find((project) => project.id === event.target.value);
              setProjectId(event.target.value);
              if (next?.clientId) setClientId(next.clientId);
            }}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Client (optional)
          <select
            className={fieldClass}
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          >
            <option value="">No client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.companyName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" isLoading={create.isPending}>
          {initial ? 'Save changes' : 'Save draft'}
        </Button>
        {initial && (
          <Button type="button" variant="secondary" onClick={onCancelEdit}>
            Cancel editing
          </Button>
        )}
      </div>
    </form>
  );
}

function FinanceHistoryFilters({
  filters,
  accounts,
  onChange,
  kind,
}: {
  filters: FinanceHistoryFilters;
  accounts: FinanceAccountRecord[];
  onChange: (patch: Partial<FinanceHistoryFilters>) => void;
  kind: 'transactions' | 'journals';
}): ReactNode {
  const [searchText, setSearchText] = useState(filters.search ?? '');
  const invalidDates = Boolean(filters.from && filters.to && filters.from >= filters.to);
  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
      aria-label={`${kind === 'transactions' ? 'Transaction' : 'Journal'} history filters`}
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ search: searchText.trim() || undefined });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          type="date"
          label="From (inclusive)"
          value={filters.from ?? ''}
          onChange={(event) => onChange({ from: event.target.value || undefined })}
        />
        <Input
          type="date"
          label="To (exclusive)"
          value={filters.to ?? ''}
          onChange={(event) => onChange({ to: event.target.value || undefined })}
        />
        <label className="text-sm font-medium">
          Account
          <select
            className={fieldClass}
            value={filters.accountId ?? ''}
            onChange={(event) => onChange({ accountId: event.target.value || undefined })}
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} · {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Currency
          <select
            className={fieldClass}
            value={filters.currency ?? ''}
            onChange={(event) => onChange({ currency: event.target.value || undefined })}
          >
            <option value="">All currencies</option>
            {[
              ...new Set([
                'USD',
                'SOS',
                ...accounts
                  .map((account) => account.currency)
                  .filter((value): value is string => Boolean(value)),
              ]),
            ].map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Search"
          value={searchText}
          maxLength={100}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={
            kind === 'transactions'
              ? 'Description, category or reference'
              : 'Reference, memo or source ID'
          }
        />
        <Button type="submit" variant="secondary">
          Apply search
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSearchText('');
            onChange({
              from: undefined,
              to: undefined,
              accountId: undefined,
              currency: undefined,
              search: undefined,
            });
          }}
        >
          Clear common filters
        </Button>
      </div>
      {invalidDates ? <p className="text-sm text-error">End date must follow start date.</p> : null}
    </form>
  );
}

function HistoryPagination({
  meta,
  onPage,
}: {
  meta?: { page: number; pageSize: number; total: number };
  onPage: (page: number) => void;
}): ReactNode {
  if (!meta || meta.total === 0) return null;
  const pages = Math.ceil(meta.total / meta.pageSize);
  return (
    <nav
      aria-label="History pages"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <span>
        Page {meta.page} of {pages} · {meta.total} records
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={meta.page >= pages}
          onClick={() => onPage(meta.page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

function TransactionList({
  rows,
  loading,
  error,
  userId,
  canCreate,
  canApprove,
  canPost,
  action,
  onEdit,
}: {
  rows: FinanceTransactionRecord[];
  loading: boolean;
  error: boolean;
  userId?: string;
  canCreate: boolean;
  canApprove: boolean;
  canPost: boolean;
  onEdit: (row: FinanceTransactionRecord) => void;
  action: (vars: {
    id: string;
    action: 'submit' | 'approve' | 'reject' | 'post' | 'cancel';
    reason?: string;
  }) => void;
}): ReactNode {
  const [reason, setReason] = useState('');
  if (loading) return <LoadingState rows={5} />;
  if (error) return <ErrorState description="Could not load finance transactions." />;
  if (!rows.length) return <EmptyState title="No transactions found" />;
  return (
    <section className="space-y-3" aria-label="Finance transactions">
      <Input
        label="Rejection reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Required when rejecting"
      />
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {row.type} · {money(row.amount, row.currency)}
                </p>
                <p className="text-sm text-muted">
                  {row.category} · {row.description}
                </p>
                <p className="text-xs text-muted">
                  {financeBusinessDate(new Date(row.occurredOn))} · {row.status}
                  {row.externalRef ? ` · Ref ${row.externalRef}` : ''}
                </p>
                {row.reviewReason ? (
                  <p className="text-xs text-muted">Review: {row.reviewReason}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {canCreate &&
                userId === row.createdById &&
                (row.status === 'DRAFT' || row.status === 'REJECTED') ? (
                  <>
                    <Button type="button" size="sm" variant="secondary" onClick={() => onEdit(row)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => action({ id: row.id, action: 'submit' })}
                    >
                      Submit
                    </Button>
                  </>
                ) : null}
                {canCreate &&
                userId === row.createdById &&
                (row.status === 'DRAFT' ||
                  row.status === 'SUBMITTED' ||
                  row.status === 'REJECTED') ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => action({ id: row.id, action: 'cancel' })}
                  >
                    Cancel
                  </Button>
                ) : null}
                {canApprove && userId !== row.createdById && row.status === 'SUBMITTED' && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => action({ id: row.id, action: 'approve' })}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={reason.trim().length < 3}
                      onClick={() => action({ id: row.id, action: 'reject', reason })}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {canPost && row.status === 'APPROVED' ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => action({ id: row.id, action: 'post' })}
                  >
                    Post to ledger
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function JournalCard({
  row,
  canManage,
  onDone,
}: {
  row: FinanceJournalRecord;
  canManage: boolean;
  onDone: (message: string) => void;
}): ReactNode {
  const [reason, setReason] = useState('');
  const reverse = useMutation({
    mutationFn: () => financeApi.reverse(row.id, reason),
    onSuccess: () => {
      setReason('');
      onDone('Reversal journal posted.');
    },
    onError: (error: Error) => onDone(error.message),
  });
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <strong>
          {row.reference} · {row.currency}
        </strong>
        <span className="text-sm text-muted">{financeBusinessDate(new Date(row.occurredOn))}</span>
      </div>
      <p className="mt-1 text-sm">{row.memo}</p>
      <ul className="mt-2 text-sm">
        {row.lines.map((line) => (
          <li
            key={line.id}
            className="flex flex-wrap justify-between gap-2 border-t border-border py-1"
          >
            <span>
              {line.accountCode} · {line.accountName}
            </span>
            <span>
              Dr {line.debit} / Cr {line.credit}
            </span>
          </li>
        ))}
      </ul>
      {row.reversedById && (
        <p className="mt-2 text-sm text-muted">Reversed by {row.reversedById}</p>
      )}
      {canManage && !row.reversesJournalId && !row.reversedById && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Input
            label="Reversal reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={reason.trim().length < 3}
            isLoading={reverse.isPending}
            onClick={() => reverse.mutate()}
          >
            Post reversal
          </Button>
        </div>
      )}
    </li>
  );
}
