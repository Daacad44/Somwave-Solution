// Company-wide money by project. Every project — including those recorded
// before the ledger — appears automatically from its invoices, payments,
// expenses and finance transactions. Every figure, bar and row is clickable.
import { type ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp, Download, Info, Wallet } from 'lucide-react';
import {
  PERMISSIONS,
  type ProjectMoneyHealth,
  type ProjectMoneyQuery,
  type ProjectMoneyRow,
} from '@somwave/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { EmptyState, ErrorState, LoadingState } from '../../../components/states';
import { cn } from '../../../lib/cn';
import { useHasPermission } from '../../../lib/rbac';
import { projectMoneyApi, projectMoneyKeys, type ProjectMoneyFilters } from './api';
import { BarList, BudgetMeter, InOutChart, KpiTile, SectionCard } from './components';
import { PayFromProjectModal, type PayTarget } from './PayFromProjectModal';
import { HEALTH, formatMoney, formatMonth, formatPercent, isNegative, statusLabel } from './format';

type QuickFilter = 'all' | 'outstanding' | 'overdue' | 'overBudget' | 'atRisk' | 'noBudget';
type Sort = ProjectMoneyQuery['sort'];

const STATUS_OPTIONS = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((value) => ({
  value,
  label: statusLabel(value),
}));

const QUICK_HEALTH: Partial<Record<QuickFilter, ProjectMoneyHealth>> = {
  overBudget: 'OVER_BUDGET',
  atRisk: 'AT_RISK',
  noBudget: 'NO_BUDGET',
};

export function ProjectMoneyOverview({
  mode,
  onOpenAll,
}: {
  /** summary: KPIs and charts for the finance overview; full: the complete projects workspace */
  mode: 'summary' | 'full';
  onOpenAll?: () => void;
}): ReactNode {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [sort, setSort] = useState<Sort>('outstanding');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [category, setCategory] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);

  const filters: ProjectMoneyFilters = {
    search: search.trim() || undefined,
    status: (status || undefined) as ProjectMoneyFilters['status'],
    health: QUICK_HEALTH[quick],
    sort,
    direction,
  };
  const overview = useQuery({
    queryKey: projectMoneyKeys.overview(mode === 'summary' ? {} : filters),
    queryFn: () => projectMoneyApi.overview(mode === 'summary' ? {} : filters),
    placeholderData: (previous) => previous,
  });

  const canPay = useHasPermission(PERMISSIONS.FINANCE_CREATE);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [chosenProject, setChosenProject] = useState('');
  const [message, setMessage] = useState('');

  const rows = useMemo(() => {
    const list = overview.data?.projects ?? [];
    if (quick === 'overdue') return list.filter((row) => Number(row.overdue) > 0);
    if (quick === 'outstanding') return list.filter((row) => Number(row.outstanding) > 0);
    return list;
  }, [overview.data, quick]);

  if (overview.isLoading) return <LoadingState rows={4} />;
  if (overview.isError || !overview.data) {
    return (
      <ErrorState
        description={
          overview.error instanceof Error ? overview.error.message : 'Could not load project money.'
        }
        onRetry={() => void overview.refetch()}
      />
    );
  }

  const data = overview.data;
  const { totals, currency } = data;
  const m = (value: string | null) => formatMoney(value, currency);
  const openProject = (projectId: string) => navigate(`/finance/projects/${projectId}`);
  const pickQuick = (next: QuickFilter, nextSort?: Sort) => {
    if (mode === 'summary') {
      onOpenAll?.();
      return;
    }
    setQuick((current) => (current === next ? 'all' : next));
    if (nextSort) {
      setSort(nextSort);
      setDirection('desc');
    }
  };
  const toggleSort = (key: Sort) => {
    if (sort === key) setDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
    else {
      setSort(key);
      setDirection(key === 'name' ? 'asc' : 'desc');
    }
  };
  const selectedCategory = data.categories.find((row) => row.category === category) ?? null;
  const selectedMonth = data.months.find((row) => row.month === month) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Project money</h2>
          <p className="text-sm text-muted">
            All {totals.projectCount} projects, from every invoice, payment and expense on record ·{' '}
            {currency}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPay ? (
            <Button size="sm" onClick={() => setChoosing(true)}>
              <Wallet className="h-4 w-4" aria-hidden="true" /> Pay from a project
            </Button>
          ) : null}
          {mode === 'summary' ? (
            <Button variant="secondary" size="sm" onClick={onOpenAll}>
              View all projects
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void projectMoneyApi.exportCsv(filters)}
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label="Total budget"
          value={m(totals.budget)}
          hint={`Planned cost ${m(totals.plannedCost)}`}
          onClick={() => pickQuick('noBudget')}
          active={quick === 'noBudget'}
        />
        <KpiTile
          label="Invoiced"
          value={m(totals.invoiced)}
          hint={`${m(totals.draftInvoiced)} still in draft`}
          onClick={() => {
            if (mode === 'full') {
              setQuick('all');
              setSort('invoiced');
              setDirection('desc');
            } else onOpenAll?.();
          }}
        />
        <KpiTile
          label="Collected (paid)"
          value={m(totals.collected)}
          tone="positive"
          hint={`${formatPercent(totals.collectionPercent)} of invoiced`}
          onClick={() => {
            if (mode === 'full') {
              setQuick('all');
              setSort('collected');
              setDirection('desc');
            } else onOpenAll?.();
          }}
        />
        <KpiTile
          label="Not yet paid"
          value={m(totals.outstanding)}
          tone={Number(totals.outstanding) > 0 ? 'warning' : 'neutral'}
          hint={`${m(totals.overdue)} overdue · ${totals.projectsWithOverdue} project(s)`}
          onClick={() => pickQuick('outstanding', 'outstanding')}
          active={quick === 'outstanding'}
        />
        <KpiTile
          label="Spent"
          value={m(totals.spent)}
          tone="negative"
          hint={`${m(totals.pendingSpend)} awaiting approval`}
          onClick={() => {
            if (mode === 'full') {
              setQuick('all');
              setSort('spent');
              setDirection('desc');
            } else onOpenAll?.();
          }}
        />
        <KpiTile
          label="Overdue"
          value={m(totals.overdue)}
          tone={Number(totals.overdue) > 0 ? 'negative' : 'neutral'}
          hint="Past due date, unpaid"
          onClick={() => pickQuick('overdue', 'outstanding')}
          active={quick === 'overdue'}
        />
        <KpiTile
          label="Profit (cash)"
          value={m(totals.cashProfit)}
          tone={isNegative(totals.cashProfit) ? 'negative' : 'positive'}
          hint={`Billed profit ${m(totals.billedProfit)} · margin ${formatPercent(totals.marginPercent)}`}
          onClick={() => {
            if (mode === 'full') {
              setQuick('all');
              setSort('profit');
              setDirection('asc');
            } else onOpenAll?.();
          }}
        />
        <KpiTile
          label="Budget alerts"
          value={`${totals.projectsOverBudget} over · ${totals.projectsAtRisk} at risk`}
          tone={
            totals.projectsOverBudget ? 'negative' : totals.projectsAtRisk ? 'warning' : 'neutral'
          }
          hint="Spent ≥ 80% of budget is at risk"
          onClick={() =>
            pickQuick(totals.projectsOverBudget ? 'overBudget' : 'atRisk', 'budgetUsed')
          }
          active={quick === 'overBudget' || quick === 'atRisk'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Money in vs money out"
          description="Last 12 months · click a month for its figures"
        >
          <InOutChart months={data.months} currency={currency} onSelectMonth={setMonth} />
        </SectionCard>
        <SectionCard title="Unpaid invoices by age" description="Click a bucket to see projects">
          <BarList
            items={[
              ['current', 'Not yet due', data.ageing.current],
              ['days1to30', '1–30 days late', data.ageing.days1to30],
              ['days31to60', '31–60 days late', data.ageing.days31to60],
              ['days61to90', '61–90 days late', data.ageing.days61to90],
              ['days90plus', '90+ days late', data.ageing.days90plus],
            ].map(([key, label, value]) => ({
              key: key!,
              label: label!,
              value: Number(value),
              display: m(value!),
            }))}
            onSelect={(key) =>
              pickQuick(key === 'current' ? 'outstanding' : 'overdue', 'outstanding')
            }
            toneClass="bg-warning"
            emptyTitle="Nothing is owed"
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Where the money went"
          description="Spending by category across all projects · click for the projects behind it"
        >
          <BarList
            items={data.categories.slice(0, mode === 'summary' ? 6 : 50).map((row) => ({
              key: row.category,
              label: row.category,
              value: Number(row.spent),
              display: m(row.spent),
              secondary:
                Number(row.planned) > 0
                  ? `Planned ${m(row.planned)}`
                  : `${row.projects.length} project(s)`,
            }))}
            onSelect={setCategory}
            toneClass="bg-error"
            emptyTitle="No spending recorded yet"
          />
        </SectionCard>
        <SectionCard
          title="Top projects by money collected"
          description="Click a project to open its full money record"
        >
          <BarList
            items={[...data.projects]
              .sort((a, b) => Number(b.collected) - Number(a.collected))
              .slice(0, 6)
              .map((row) => ({
                key: row.projectId,
                label: row.projectName,
                value: Number(row.collected),
                display: m(row.collected),
                secondary: `Spent ${m(row.spent)} · unpaid ${m(row.outstanding)}`,
              }))}
            onSelect={openProject}
            toneClass="bg-success"
            emptyTitle="No payments recorded yet"
          />
        </SectionCard>
      </div>

      {mode === 'full' ? (
        <SectionCard
          title="All projects"
          description={`${rows.length} of ${totals.projectCount} shown · click any row to open the project`}
        >
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_200px_200px]">
            <Input
              label="Search project or client"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              label="Project status"
              value={status}
              placeholder="All statuses"
              options={STATUS_OPTIONS}
              onChange={(event) => setStatus(event.target.value)}
            />
            <Select
              label="Show"
              value={quick}
              options={[
                { value: 'all', label: 'All projects' },
                { value: 'outstanding', label: 'Has unpaid invoices' },
                { value: 'overdue', label: 'Has overdue invoices' },
                { value: 'overBudget', label: 'Over budget' },
                { value: 'atRisk', label: 'At risk (≥ 80% used)' },
                { value: 'noBudget', label: 'No budget set' },
              ]}
              onChange={(event) => setQuick(event.target.value as QuickFilter)}
            />
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No projects match these filters" />
          ) : (
            <ProjectsTable
              rows={rows}
              currency={currency}
              sort={sort}
              direction={direction}
              onSort={toggleSort}
              onOpen={openProject}
              onPay={canPay ? (row) => setPayTarget(payTargetFor(row, currency)) : undefined}
            />
          )}
          {Number(totals.unassigned.invoiced) > 0 ? (
            <p className="mt-3 text-sm text-muted">
              Invoices not linked to any project: {m(totals.unassigned.invoiced)} invoiced,{' '}
              {m(totals.unassigned.collected)} collected, {m(totals.unassigned.outstanding)} unpaid.
              They are included in the totals above.{' '}
              <Link to="/invoices" className="font-medium text-brand underline">
                Open invoices
              </Link>
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      <details className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        <summary className="flex cursor-pointer items-center gap-2 font-medium text-ink">
          <Info className="h-4 w-4" aria-hidden="true" /> How these figures are calculated
        </summary>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          {data.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>

      {message ? (
        <p
          role="status"
          className="rounded-md border border-border bg-surface p-3 text-sm text-ink"
        >
          {message}
        </p>
      ) : null}

      <Modal open={choosing} onClose={() => setChoosing(false)} title="Pay from a project">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const row = data.projects.find((item) => item.projectId === chosenProject);
            if (!row) return;
            setChoosing(false);
            setPayTarget(payTargetFor(row, currency));
          }}
        >
          <Select
            label="Which project is paying?"
            value={chosenProject}
            placeholder="Choose a project"
            options={[...data.projects]
              .sort((a, b) => a.projectName.localeCompare(b.projectName))
              .map((row) => ({
                value: row.projectId,
                label: `${row.projectName}${row.remainingBudget !== null ? ` — ${m(row.remainingBudget)} left` : ''}`,
              }))}
            onChange={(event) => setChosenProject(event.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setChoosing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!chosenProject}>
              Continue
            </Button>
          </div>
        </form>
      </Modal>

      <PayFromProjectModal
        target={payTarget}
        onClose={() => setPayTarget(null)}
        onDone={setMessage}
      />

      <Modal
        open={selectedCategory !== null}
        onClose={() => setCategory(null)}
        title={selectedCategory ? `Spending: ${selectedCategory.category}` : undefined}
      >
        {selectedCategory ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {m(selectedCategory.spent)} spent
              {Number(selectedCategory.planned) > 0
                ? ` · ${m(selectedCategory.planned)} planned`
                : ''}
            </p>
            <BarList
              items={selectedCategory.projects.map((row) => ({
                key: row.projectId,
                label: row.projectName,
                value: Number(row.spent),
                display: m(row.spent),
              }))}
              onSelect={(projectId) => {
                setCategory(null);
                openProject(projectId);
              }}
              toneClass="bg-error"
              emptyTitle="Only planned amounts in this category"
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={selectedMonth !== null}
        onClose={() => setMonth(null)}
        title={selectedMonth ? formatMonth(selectedMonth.month) : undefined}
      >
        {selectedMonth ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted">Money in</dt>
            <dd className="text-end font-semibold text-success">{m(selectedMonth.moneyIn)}</dd>
            <dt className="text-muted">Money out</dt>
            <dd className="text-end font-semibold text-error">{m(selectedMonth.moneyOut)}</dd>
            <dt className="text-muted">Net</dt>
            <dd className="text-end font-semibold">
              {m((Number(selectedMonth.moneyIn) - Number(selectedMonth.moneyOut)).toFixed(2))}
            </dd>
            <dt className="text-muted">Invoiced</dt>
            <dd className="text-end font-semibold">{m(selectedMonth.invoiced)}</dd>
          </dl>
        ) : null}
      </Modal>
    </div>
  );
}

const COLUMNS: { key: Sort | null; label: string; align?: 'end' }[] = [
  { key: 'name', label: 'Project' },
  { key: 'budget', label: 'Budget', align: 'end' },
  { key: 'spent', label: 'Spent', align: 'end' },
  { key: 'invoiced', label: 'Invoiced', align: 'end' },
  { key: 'collected', label: 'Paid', align: 'end' },
  { key: 'outstanding', label: 'Unpaid', align: 'end' },
  { key: 'profit', label: 'Profit', align: 'end' },
  { key: 'budgetUsed', label: 'Budget used' },
  { key: null, label: 'Health' },
];

function ProjectsTable({
  rows,
  currency,
  sort,
  direction,
  onSort,
  onOpen,
  onPay,
}: {
  rows: readonly ProjectMoneyRow[];
  currency: string;
  sort: Sort;
  direction: 'asc' | 'desc';
  onSort: (key: Sort) => void;
  onOpen: (projectId: string) => void;
  onPay?: (row: ProjectMoneyRow) => void;
}): ReactNode {
  const m = (value: string | null) => formatMoney(value, currency);
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[1080px] text-sm">
        <thead className="bg-surface-alt">
          <tr>
            {[...COLUMNS, ...(onPay ? [{ key: null, label: '', align: 'end' as const }] : [])].map(
              (column) => (
                <th
                  key={column.label || 'actions'}
                  scope="col"
                  aria-sort={
                    column.key && sort === column.key
                      ? direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  className={cn(
                    'p-3 font-semibold text-muted',
                    column.align === 'end' ? 'text-end' : 'text-start',
                  )}
                >
                  {column.key ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.key!)}
                      className="inline-flex items-center gap-1 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {column.label}
                      <ArrowDownUp
                        className={cn(
                          'h-3.5 w-3.5',
                          sort === column.key ? 'text-brand' : 'opacity-40',
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.projectId}
              className="cursor-pointer border-t border-border hover:bg-surface-alt"
              onClick={() => onOpen(row.projectId)}
            >
              <td className="p-3">
                <Link
                  to={`/finance/projects/${row.projectId}`}
                  className="font-medium text-ink hover:text-brand hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.projectName}
                </Link>
                <span className="block text-xs text-muted">
                  {row.clientName ?? 'No client'} · {statusLabel(row.status)}
                </span>
              </td>
              <td className="p-3 text-end tabular-nums">{m(row.budget)}</td>
              <td className="p-3 text-end tabular-nums">
                {m(row.spent)}
                {Number(row.pendingSpend) > 0 ? (
                  <span className="block text-xs text-muted">+{m(row.pendingSpend)} pending</span>
                ) : null}
              </td>
              <td className="p-3 text-end tabular-nums">{m(row.invoiced)}</td>
              <td className="p-3 text-end tabular-nums text-success">{m(row.collected)}</td>
              <td className="p-3 text-end tabular-nums">
                {m(row.outstanding)}
                {Number(row.overdue) > 0 ? (
                  <span className="block text-xs font-medium text-error">
                    {m(row.overdue)} overdue
                  </span>
                ) : null}
              </td>
              <td
                className={cn(
                  'p-3 text-end font-medium tabular-nums',
                  isNegative(row.cashProfit) ? 'text-error' : 'text-success',
                )}
              >
                {m(row.cashProfit)}
              </td>
              <td className="w-44 p-3">
                <BudgetMeter
                  budget={row.budget}
                  spent={row.spent}
                  planned={row.plannedCost}
                  currency={currency}
                />
              </td>
              <td className="whitespace-nowrap p-3">
                <Badge tone={HEALTH[row.health].tone}>{HEALTH[row.health].label}</Badge>
              </td>
              {onPay ? (
                <td className="p-3 text-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPay(row);
                    }}
                  >
                    Pay
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function payTargetFor(row: ProjectMoneyRow, currency: string): PayTarget {
  return {
    projectId: row.projectId,
    projectName: row.projectName,
    clientId: row.clientId,
    currency,
    budget: row.budget,
    spent: row.spent,
    pendingSpend: row.pendingSpend,
  };
}
