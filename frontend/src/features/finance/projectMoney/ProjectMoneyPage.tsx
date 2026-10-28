// One project's complete money record: budget, what was invoiced, what was
// paid, what is still owed, where the money was spent, and the time behind it.
// Every tile switches to the tab holding its rows; every row opens its source.
import { type ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ExternalLink, Wallet } from 'lucide-react';
import { PERMISSIONS, type ProjectMoneyDetail, type ProjectMoneySpend } from '@somwave/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../../components/states';
import { cn } from '../../../lib/cn';
import { useHasPermission } from '../../../lib/rbac';
import { FinanceStepUp, financeAccessReason } from '../FinanceStepUp';
import { projectMoneyApi, projectMoneyKeys } from './api';
import { BarList, BudgetMeter, CumulativeChart, KpiTile, SectionCard } from './components';
import { PayFromProjectModal, type PayTarget } from './PayFromProjectModal';
import { SpendActions, availableActions, useSpendPermissions } from './SpendActions';
import {
  HEALTH,
  formatDate,
  formatMoney,
  formatPercent,
  invoiceTone,
  isNegative,
  statusLabel,
} from './format';

type Tab = 'Overview' | 'Invoices' | 'Payments' | 'Spending' | 'Other income' | 'Budget history';
const TABS: Tab[] = [
  'Overview',
  'Invoices',
  'Payments',
  'Spending',
  'Other income',
  'Budget history',
];

export function ProjectMoneyPage(): ReactNode {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const detail = useQuery({
    queryKey: projectMoneyKeys.detail(projectId),
    queryFn: () => projectMoneyApi.detail(projectId),
    enabled: Boolean(projectId),
  });
  const accessReason = financeAccessReason(detail.error);

  return (
    <div className="space-y-5">
      <Link
        to="/finance?tab=Projects"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All projects money
      </Link>
      {accessReason ? (
        <FinanceStepUp reason={accessReason} />
      ) : detail.isLoading ? (
        <LoadingState rows={5} />
      ) : detail.isError || !detail.data ? (
        <ErrorState
          description={
            detail.error instanceof Error ? detail.error.message : 'Could not load this project.'
          }
          onRetry={() => void detail.refetch()}
        />
      ) : (
        <ProjectMoneyView data={detail.data} />
      )}
    </div>
  );
}

function ProjectMoneyView({ data }: { data: ProjectMoneyDetail }): ReactNode {
  const [tab, setTab] = useState<Tab>('Overview');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [spend, setSpend] = useState<ProjectMoneySpend | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [message, setMessage] = useState('');
  const canPay = useHasPermission(PERMISSIONS.FINANCE_CREATE);
  const { userId, can } = useSpendPermissions();
  const { figures, currency, project } = data;
  const openPay = () =>
    setPayTarget({
      projectId: project.id,
      projectName: project.name,
      clientId: project.clientId,
      currency,
      budget: figures.budget,
      spent: figures.spent,
      pendingSpend: figures.pendingSpend,
      members: data.members,
    });
  const needsMe = data.spending.filter((row) =>
    availableActions(row, userId, can).some((a) => a !== 'cancel'),
  );
  const inFlight = data.spending.filter(
    (row) =>
      row.source === 'FINANCE_TRANSACTION' &&
      ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(row.state),
  );
  const m = (value: string | null) => formatMoney(value, currency);
  const duplicates = data.spending.filter((row) => row.possibleDuplicateOf).length;
  const go = (next: Tab, category: string | null = null) => {
    setTab(next);
    setCategoryFilter(category);
  };
  const counts: Partial<Record<Tab, number>> = {
    Invoices: data.invoices.length,
    Payments: data.payments.length,
    Spending: data.spending.length,
    'Other income': data.otherIncome.length,
    'Budget history': data.budgetHistory.length,
  };

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{project.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {project.clientId ? (
              <Link to={`/clients/${project.clientId}`} className="text-brand hover:underline">
                {project.clientName}
              </Link>
            ) : (
              <span>No client</span>
            )}
            <span>{statusLabel(project.status)}</span>
            {project.managerName ? <span>Manager: {project.managerName}</span> : null}
            <span>
              {formatDate(project.startDate)} → {formatDate(project.dueDate)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={HEALTH[data.health].tone}>{HEALTH[data.health].label}</Badge>
          {canPay ? (
            <Button onClick={openPay}>
              <Wallet className="h-4 w-4" aria-hidden="true" /> Pay from this project
            </Button>
          ) : null}
          <Link
            to={`/projects/${project.id}`}
            className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-alt"
          >
            Open project <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {message ? (
        <p
          role="status"
          className="rounded-md border border-border bg-surface p-3 text-sm text-ink"
        >
          {message}
        </p>
      ) : null}

      {inFlight.length > 0 ? (
        <SectionCard
          title={
            needsMe.length
              ? `${needsMe.length} payment(s) need your action`
              : 'Payments in progress'
          }
          description="Payments from this project that are not yet posted to the ledger"
        >
          <ul className="divide-y divide-border">
            {inFlight.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setSpend(row)}
                  className="min-w-0 text-start hover:underline"
                >
                  <span className="block truncate text-sm font-medium text-ink">
                    {row.category} · {row.description}
                  </span>
                  <span className="text-xs text-muted">
                    {formatMoney(row.amount, row.currency)} · {row.counterparty ?? 'No payee'} ·{' '}
                    {formatDate(row.date)} · {statusLabel(row.state)}
                    {row.state === 'REJECTED' && row.reviewReason ? ` — ${row.reviewReason}` : ''}
                  </span>
                  {figures.budget !== null &&
                  Number(figures.spent) + Number(row.amount) > Number(figures.budget) ? (
                    <span className="mt-0.5 block text-xs font-medium text-error">
                      Paying this takes the project over budget
                    </span>
                  ) : null}
                </button>
                <SpendActions row={row} onMessage={setMessage} />
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {duplicates > 0 ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft p-3 text-sm text-ink"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          {duplicates} spending record(s) may have been entered twice. Both are counted until one is
          removed.{' '}
          <button type="button" className="font-medium underline" onClick={() => go('Spending')}>
            Review spending
          </button>
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <KpiTile
          label="Budget"
          value={m(figures.budget)}
          hint={`Planned cost ${m(figures.plannedCost)}`}
          onClick={() => go('Budget history')}
        />
        <KpiTile
          label="Spent"
          value={m(figures.spent)}
          tone="negative"
          hint={`${formatPercent(figures.budgetUsedPercent)} of budget`}
          onClick={() => go('Spending')}
        />
        <KpiTile
          label="Budget remaining"
          value={m(figures.remainingBudget)}
          tone={isNegative(figures.remainingBudget) ? 'negative' : 'neutral'}
          hint={
            Number(figures.pendingSpend) > 0
              ? `${m(figures.pendingSpend)} awaiting approval`
              : undefined
          }
          onClick={() => go('Spending')}
        />
        <KpiTile
          label="Invoiced"
          value={m(figures.invoiced)}
          hint={`${m(figures.draftInvoiced)} in draft`}
          onClick={() => go('Invoices')}
        />
        <KpiTile
          label="Paid"
          value={m(figures.collected)}
          tone="positive"
          hint={`${formatPercent(figures.collectionPercent)} of invoiced`}
          onClick={() => go('Payments')}
        />
        <KpiTile
          label="Not yet paid"
          value={m(figures.outstanding)}
          tone={Number(figures.outstanding) > 0 ? 'warning' : 'neutral'}
          onClick={() => go('Invoices')}
        />
        <KpiTile
          label="Overdue"
          value={m(figures.overdue)}
          tone={Number(figures.overdue) > 0 ? 'negative' : 'neutral'}
          onClick={() => go('Invoices')}
        />
        <KpiTile
          label="Profit (cash)"
          value={m(figures.cashProfit)}
          tone={isNegative(figures.cashProfit) ? 'negative' : 'positive'}
          hint="Paid minus spent"
        />
        <KpiTile
          label="Profit (billed)"
          value={m(figures.billedProfit)}
          tone={isNegative(figures.billedProfit) ? 'negative' : 'positive'}
          hint={`Margin ${formatPercent(figures.marginPercent)}`}
        />
        <KpiTile
          label="Hours logged"
          value={`${figures.hoursLogged} h`}
          onClick={() => go('Overview')}
        />
      </div>

      <SectionCard title="Budget use">
        <BudgetMeter
          budget={figures.budget}
          spent={figures.spent}
          planned={figures.plannedCost}
          currency={currency}
        />
      </SectionCard>

      <nav
        aria-label="Project money sections"
        className="flex gap-2 overflow-x-auto border-b border-border pb-2"
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => go(name)}
            aria-current={tab === name ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              tab === name ? 'bg-primary text-surface' : 'text-ink hover:bg-surface-alt',
            )}
          >
            {name}
            {counts[name] !== undefined ? (
              <span className="ms-1.5 text-xs opacity-75">{counts[name]}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === 'Overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            className="lg:col-span-2"
            title="Money over the life of the project"
            description="Cumulative paid vs spent, with the budget line"
          >
            <CumulativeChart timeline={data.timeline} budget={figures.budget} currency={currency} />
          </SectionCard>
          <SectionCard
            title="Where the money went"
            description="Actual spending by category · click to see the records"
          >
            <BarList
              items={data.categories.map((row) => ({
                key: row.category,
                label: row.category,
                value: Number(row.spent),
                display: m(row.spent),
                secondary: Number(row.planned) > 0 ? `Planned ${m(row.planned)}` : undefined,
              }))}
              onSelect={(category) => go('Spending', category)}
              toneClass="bg-error"
              emptyTitle="No spending recorded yet"
            />
          </SectionCard>
          <SectionCard title="Planned vs actual by category">
            {data.categories.length === 0 ? (
              <EmptyState title="No planned or actual costs yet" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted">
                    <th className="pb-2 text-start font-medium">Category</th>
                    <th className="pb-2 text-end font-medium">Planned</th>
                    <th className="pb-2 text-end font-medium">Actual</th>
                    <th className="pb-2 text-end font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((row) => {
                    const diff = (Number(row.planned) - Number(row.spent)).toFixed(2);
                    return (
                      <tr
                        key={row.category}
                        className="cursor-pointer border-t border-border hover:bg-surface-alt"
                        onClick={() => go('Spending', row.category)}
                      >
                        <td className="py-2 font-medium">{row.category}</td>
                        <td className="py-2 text-end tabular-nums">{m(row.planned)}</td>
                        <td className="py-2 text-end tabular-nums">{m(row.spent)}</td>
                        <td
                          className={cn(
                            'py-2 text-end tabular-nums',
                            Number(diff) < 0 ? 'text-error' : 'text-success',
                          )}
                        >
                          {m(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </SectionCard>
          <SectionCard title="Time by phase" description="Hours logged on this project's tasks">
            <BarList
              items={data.hoursByPhase.map((row) => ({
                key: row.phaseId ?? 'none',
                label: row.title,
                value: Number(row.hours),
                display: `${row.hours} h`,
              }))}
              emptyTitle="No time logged yet"
            />
          </SectionCard>
          <SectionCard title="Time by person">
            <BarList
              items={data.hoursByPerson.map((row) => ({
                key: row.userId,
                label: row.name,
                value: Number(row.hours),
                display: `${row.hours} h`,
              }))}
              emptyTitle="No time logged yet"
            />
          </SectionCard>
        </div>
      ) : null}

      {tab === 'Invoices' ? (
        <RecordTable
          empty="No invoices for this project"
          headers={['Invoice', 'Status', 'Issued', 'Due', 'Total', 'Paid', 'Unpaid']}
          rows={data.invoices.map((invoice) => ({
            key: invoice.id,
            to: `/invoices/${invoice.id}`,
            cells: [
              <span key="n" className="font-medium text-brand">
                {invoice.number}
              </span>,
              <Badge key="s" tone={invoiceTone(invoice.status)}>
                {statusLabel(invoice.status)}
              </Badge>,
              formatDate(invoice.issueDate),
              <span key="d">
                {formatDate(invoice.dueDate)}
                {invoice.daysOverdue > 0 ? (
                  <span className="block text-xs font-medium text-error">
                    {invoice.daysOverdue} days late
                  </span>
                ) : null}
              </span>,
              m(invoice.total),
              m(invoice.paid),
              m(invoice.outstanding),
            ],
          }))}
          numericFrom={4}
        />
      ) : null}

      {tab === 'Payments' ? (
        <RecordTable
          empty="No payments for this project"
          headers={['Date', 'Invoice', 'Method', 'Status', 'Reference', 'Amount']}
          rows={data.payments.map((payment) => ({
            key: payment.id,
            to: `/invoices/${payment.invoiceId}`,
            cells: [
              formatDate(payment.date),
              <span key="i" className="font-medium text-brand">
                {payment.invoiceNumber}
              </span>,
              statusLabel(payment.method),
              <Badge
                key="s"
                tone={
                  payment.status === 'COMPLETED'
                    ? 'success'
                    : payment.status === 'FAILED'
                      ? 'error'
                      : 'warning'
                }
              >
                {statusLabel(payment.status)}
              </Badge>,
              payment.reference ?? '—',
              m(payment.amount),
            ],
          }))}
          numericFrom={5}
        />
      ) : null}

      {tab === 'Spending' ? (
        <SpendingTab
          rows={data.spending}
          categoryFilter={categoryFilter}
          onClearCategory={() => setCategoryFilter(null)}
          onOpen={setSpend}
          onMessage={setMessage}
        />
      ) : null}

      {tab === 'Other income' ? (
        <RecordTable
          empty="No other income linked to this project"
          headers={['Date', 'Category', 'Description', 'From', 'State', 'Amount']}
          rows={data.otherIncome.map((row) => ({
            key: row.id,
            cells: [
              formatDate(row.date),
              row.category,
              row.description,
              row.counterparty ?? '—',
              <Badge key="s" tone={row.status === 'POSTED' ? 'success' : 'neutral'}>
                {statusLabel(row.status)}
              </Badge>,
              formatMoney(row.amount, row.currency),
            ],
          }))}
          numericFrom={5}
        />
      ) : null}

      {tab === 'Budget history' ? (
        <RecordTable
          empty="The budget has never been revised"
          headers={['Date', 'Previous budget', 'New budget', 'Reason']}
          rows={data.budgetHistory.map((row) => ({
            key: row.id,
            cells: [formatDate(row.date), m(row.previousBudget), m(row.newBudget), row.reason],
          }))}
        />
      ) : null}

      <details className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-ink">
          How these figures are calculated
        </summary>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          {data.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>

      <PayFromProjectModal
        target={payTarget}
        onClose={() => setPayTarget(null)}
        onDone={setMessage}
      />

      <Modal open={spend !== null} onClose={() => setSpend(null)} title="Spending record">
        {spend ? (
          <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Amount</dt>
            <dd className="font-semibold">{formatMoney(spend.amount, spend.currency)}</dd>
            <dt className="text-muted">Category</dt>
            <dd>{spend.category}</dd>
            <dt className="text-muted">Description</dt>
            <dd>{spend.description}</dd>
            <dt className="text-muted">Date</dt>
            <dd>{formatDate(spend.date)}</dd>
            <dt className="text-muted">Source</dt>
            <dd>
              {spend.source === 'PROJECT_EXPENSE' ? 'Project expense' : 'Finance transaction'}
            </dd>
            <dt className="text-muted">State</dt>
            <dd>{statusLabel(spend.state)}</dd>
            {spend.counterparty ? (
              <>
                <dt className="text-muted">Paid to</dt>
                <dd>{spend.counterparty}</dd>
              </>
            ) : null}
            {spend.paymentMethod ? (
              <>
                <dt className="text-muted">Method</dt>
                <dd>
                  {spend.paymentMethod}
                  {spend.reference ? ` · ${spend.reference}` : ''}
                </dd>
              </>
            ) : null}
            {spend.reviewReason ? (
              <>
                <dt className="text-muted">Review note</dt>
                <dd>{spend.reviewReason}</dd>
              </>
            ) : null}
            <dt className="text-muted">Counted as spent</dt>
            <dd>
              {spend.countsAsSpent ? 'Yes' : 'No — planned, pending approval or another currency'}
            </dd>
            {spend.possibleDuplicateOf ? (
              <>
                <dt className="text-muted">Warning</dt>
                <dd className="text-warning">
                  Matches a project expense with the same amount and date. Remove or reverse one of
                  them if it was entered twice.
                </dd>
              </>
            ) : null}
            <dt className="text-muted">Where to edit</dt>
            <dd>
              {spend.source === 'PROJECT_EXPENSE' ? (
                <Link to={`/projects/${data.project.id}`} className="text-brand underline">
                  Project page → Finance
                </Link>
              ) : (
                <Link to="/finance?tab=Transactions" className="text-brand underline">
                  Finance → Transactions
                </Link>
              )}
            </dd>
          </dl>
        ) : null}
      </Modal>
    </>
  );
}

interface RecordRow {
  key: string;
  cells: ReactNode[];
  to?: string;
  onClick?: () => void;
}

function RecordTable({
  headers,
  rows,
  empty,
  numericFrom,
}: {
  headers: string[];
  rows: RecordRow[];
  empty: string;
  /** index of the first right-aligned money column */
  numericFrom?: number;
}): ReactNode {
  if (!rows.length) return <EmptyState title={empty} />;
  const align = (index: number) =>
    numericFrom !== undefined && index >= numericFrom ? 'text-end tabular-nums' : 'text-start';
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-surface-alt">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={cn('p-3 font-semibold text-muted', align(index))}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const clickable = Boolean(row.to || row.onClick);
            return (
              <tr
                key={row.key}
                className={cn('border-t border-border', clickable && 'hover:bg-surface-alt')}
              >
                {row.cells.map((cell, index) => (
                  <td key={index} className={cn('p-0', align(index))}>
                    {row.to ? (
                      <Link to={row.to} className="block p-3" tabIndex={index === 0 ? 0 : -1}>
                        {cell}
                      </Link>
                    ) : row.onClick ? (
                      <button
                        type="button"
                        onClick={row.onClick}
                        className={cn('block w-full p-3', align(index))}
                        tabIndex={index === 0 ? 0 : -1}
                      >
                        {cell}
                      </button>
                    ) : (
                      <div className="p-3">{cell}</div>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpendingTab({
  rows,
  categoryFilter,
  onClearCategory,
  onOpen,
  onMessage,
}: {
  rows: readonly ProjectMoneySpend[];
  categoryFilter: string | null;
  onClearCategory: () => void;
  onOpen: (row: ProjectMoneySpend) => void;
  onMessage: (message: string) => void;
}): ReactNode {
  const visible = rows.filter((row) => !categoryFilter || row.category === categoryFilter);
  return (
    <div className="space-y-3">
      {categoryFilter ? (
        <p className="flex items-center gap-2 text-sm">
          Showing <strong>{categoryFilter}</strong>
          <button type="button" className="text-brand underline" onClick={onClearCategory}>
            Show all
          </button>
        </p>
      ) : null}
      {visible.length === 0 ? (
        <EmptyState title="No spending recorded for this project" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-surface-alt">
              <tr>
                {['Date', 'For', 'Description', 'Paid to', 'State', 'Amount', ''].map(
                  (header, index) => (
                    <th
                      key={header || index}
                      scope="col"
                      className={cn(
                        'p-3 font-semibold text-muted',
                        index >= 5 ? 'text-end' : 'text-start',
                      )}
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={`${row.source}-${row.id}`}
                  className="border-t border-border hover:bg-surface-alt"
                >
                  <td className="whitespace-nowrap p-3">{formatDate(row.date)}</td>
                  <td className="p-3">{row.category}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => onOpen(row)}
                      className="text-start hover:underline"
                    >
                      {row.description}
                    </button>
                    <span className="block text-xs text-muted">
                      {row.source === 'PROJECT_EXPENSE' ? 'Project expense' : 'Finance payment'}
                    </span>
                    {row.possibleDuplicateOf ? (
                      <span className="block text-xs font-medium text-warning">
                        Possible duplicate of a project expense
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">{row.counterparty ?? '—'}</td>
                  <td className="p-3">
                    <Badge
                      tone={
                        row.countsAsSpent
                          ? 'success'
                          : row.state === 'REJECTED'
                            ? 'error'
                            : 'neutral'
                      }
                    >
                      {statusLabel(row.state)}
                    </Badge>
                  </td>
                  <td
                    className={cn('p-3 text-end tabular-nums', !row.countsAsSpent && 'text-muted')}
                  >
                    {formatMoney(row.amount, row.currency)}
                  </td>
                  <td className="p-3 text-end">
                    <SpendActions row={row} onMessage={onMessage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        Planned amounts and payments not yet posted are listed but not counted as spent.
      </p>
    </div>
  );
}
