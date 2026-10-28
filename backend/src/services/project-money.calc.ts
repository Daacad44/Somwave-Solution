// Pure aggregation for the project money read model. No Prisma access here, so
// every rule is unit-tested without a database. All arithmetic uses
// Prisma.Decimal; amounts leave this module as fixed two-decimal strings.
import { Prisma } from '@prisma/client';
import type {
  ProjectMoneyAgeing,
  ProjectMoneyFigures,
  ProjectMoneyHealth,
  ProjectMoneyMonth,
} from '@somwave/shared';

export type Decimal = Prisma.Decimal;
export const ZERO = new Prisma.Decimal(0);

/** Invoice states that represent money billed to the client. */
export const BILLED_STATUSES = new Set(['SENT', 'PARTIAL', 'PAID', 'OVERDUE']);
/** Invoice states that can still have a balance owed. */
export const OPEN_STATUSES = new Set(['SENT', 'PARTIAL', 'OVERDUE']);
/** Finance transaction states that are waiting for approval or posting. */
export const PENDING_TX_STATUSES = new Set(['SUBMITTED', 'APPROVED']);

const AT_RISK_PERCENT = 80;
const DAY_MS = 86_400_000;
const BUSINESS_OFFSET_MS = 3 * 60 * 60 * 1000; // Africa/Mogadishu, UTC+03:00

export interface MoneyProject {
  id: string;
  name: string;
  status: string;
  clientId: string | null;
  clientName: string | null;
  budget: Decimal | null;
}
export interface MoneyInvoice {
  id: string;
  number: string;
  projectId: string | null;
  status: string;
  issueDate: Date;
  dueDate: Date;
  total: Decimal;
  paidAmount: Decimal;
}
export interface MoneyPayment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  projectId: string | null;
  amount: Decimal;
  method: string;
  status: string;
  reference: string | null;
  date: Date;
}
export interface MoneyExpense {
  id: string;
  projectId: string;
  kind: 'PLANNED' | 'ACTUAL';
  category: string;
  description: string;
  amount: Decimal;
  date: Date;
}
export interface MoneyTransaction {
  id: string;
  projectId: string | null;
  type: 'INCOME' | 'EXPENSE';
  status: string;
  category: string;
  description: string;
  amount: Decimal;
  currency: string;
  date: Date;
  counterparty: string | null;
  createdById?: string | null;
  reviewedById?: string | null;
  reviewReason?: string | null;
  paymentMethod?: string | null;
  externalRef?: string | null;
}
export interface MoneyTime {
  projectId: string;
  minutes: number;
  userId: string;
  userName: string;
  phaseId: string | null;
  phaseTitle: string | null;
}

export function money(value: Decimal): string {
  return value.toFixed(2);
}

export function percent(part: Decimal, whole: Decimal | null): string | null {
  if (!whole || whole.lte(0)) return null;
  return part.div(whole).mul(100).toDecimalPlaces(1).toFixed(1);
}

export function businessMonth(date: Date): string {
  return new Date(date.getTime() + BUSINESS_OFFSET_MS).toISOString().slice(0, 7);
}

/** The last `count` business months ending with the month of `now`, oldest first. */
export function lastMonths(now: Date, count: number): string[] {
  const local = new Date(now.getTime() + BUSINESS_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(year, month - (count - 1 - index), 1)).toISOString().slice(0, 7),
  );
}

export function invoiceOutstanding(invoice: MoneyInvoice): Decimal {
  if (!OPEN_STATUSES.has(invoice.status)) return ZERO;
  const owed = invoice.total.sub(invoice.paidAmount);
  return owed.gt(0) ? owed : ZERO;
}

export function daysOverdue(invoice: MoneyInvoice, now: Date): number {
  if (invoiceOutstanding(invoice).lte(0)) return 0;
  const days = Math.floor((now.getTime() - invoice.dueDate.getTime()) / DAY_MS);
  return days > 0 ? days : 0;
}

/** A spending row counts once it is a recorded actual cost or a posted ledger expense. */
export function expenseCountsAsSpent(expense: MoneyExpense): boolean {
  return expense.kind === 'ACTUAL';
}
export function transactionCounts(tx: MoneyTransaction, currency: string): boolean {
  return tx.status === 'POSTED' && tx.currency === currency;
}

export function health(spent: Decimal, budget: Decimal | null): ProjectMoneyHealth {
  if (!budget || budget.lte(0)) return 'NO_BUDGET';
  const used = spent.div(budget).mul(100);
  if (used.gt(100)) return 'OVER_BUDGET';
  if (used.gte(AT_RISK_PERCENT)) return 'AT_RISK';
  return 'ON_TRACK';
}

/**
 * Flags a posted expense transaction that looks like a re-entry of an actual
 * project expense: same project, same amount, dated within three days.
 * Both rows still count; the flag asks a person to resolve it.
 */
export function findDuplicates(
  expenses: readonly MoneyExpense[],
  transactions: readonly MoneyTransaction[],
): Map<string, string> {
  const result = new Map<string, string>();
  const claimed = new Set<string>();
  for (const tx of transactions) {
    if (tx.type !== 'EXPENSE' || tx.status !== 'POSTED' || !tx.projectId) continue;
    const match = expenses.find(
      (expense) =>
        !claimed.has(expense.id) &&
        expense.kind === 'ACTUAL' &&
        expense.projectId === tx.projectId &&
        expense.amount.eq(tx.amount) &&
        Math.abs(expense.date.getTime() - tx.date.getTime()) <= 3 * DAY_MS,
    );
    if (match) {
      claimed.add(match.id);
      result.set(tx.id, match.id);
    }
  }
  return result;
}

export interface FigureInputs {
  budget: Decimal | null;
  invoices: readonly MoneyInvoice[];
  payments: readonly MoneyPayment[];
  expenses: readonly MoneyExpense[];
  transactions: readonly MoneyTransaction[];
  minutes: number;
  currency: string;
  now: Date;
}

export interface Figures {
  budget: Decimal | null;
  plannedCost: Decimal;
  invoiced: Decimal;
  draftInvoiced: Decimal;
  collected: Decimal;
  outstanding: Decimal;
  overdue: Decimal;
  spent: Decimal;
  pendingSpend: Decimal;
  invoiceCount: number;
  overdueInvoiceCount: number;
  minutes: number;
}

export function computeFigures(input: FigureInputs): Figures {
  const figures: Figures = {
    budget: input.budget,
    plannedCost: ZERO,
    invoiced: ZERO,
    draftInvoiced: ZERO,
    collected: ZERO,
    outstanding: ZERO,
    overdue: ZERO,
    spent: ZERO,
    pendingSpend: ZERO,
    invoiceCount: 0,
    overdueInvoiceCount: 0,
    minutes: input.minutes,
  };
  for (const invoice of input.invoices) {
    if (invoice.status === 'DRAFT') {
      figures.draftInvoiced = figures.draftInvoiced.add(invoice.total);
      continue;
    }
    if (!BILLED_STATUSES.has(invoice.status)) continue;
    figures.invoiceCount += 1;
    figures.invoiced = figures.invoiced.add(invoice.total);
    const owed = invoiceOutstanding(invoice);
    figures.outstanding = figures.outstanding.add(owed);
    if (daysOverdue(invoice, input.now) > 0) {
      figures.overdue = figures.overdue.add(owed);
      figures.overdueInvoiceCount += 1;
    }
  }
  for (const payment of input.payments) {
    if (payment.status === 'COMPLETED') figures.collected = figures.collected.add(payment.amount);
  }
  for (const expense of input.expenses) {
    if (expense.kind === 'PLANNED') figures.plannedCost = figures.plannedCost.add(expense.amount);
    else figures.spent = figures.spent.add(expense.amount);
  }
  for (const tx of input.transactions) {
    if (tx.currency !== input.currency) continue;
    if (tx.type === 'INCOME' && tx.status === 'POSTED') {
      figures.collected = figures.collected.add(tx.amount);
    } else if (tx.type === 'EXPENSE' && tx.status === 'POSTED') {
      figures.spent = figures.spent.add(tx.amount);
    } else if (tx.type === 'EXPENSE' && PENDING_TX_STATUSES.has(tx.status)) {
      figures.pendingSpend = figures.pendingSpend.add(tx.amount);
    }
  }
  return figures;
}

export function addFigures(a: Figures, b: Figures): Figures {
  return {
    budget: a.budget || b.budget ? (a.budget ?? ZERO).add(b.budget ?? ZERO) : null,
    plannedCost: a.plannedCost.add(b.plannedCost),
    invoiced: a.invoiced.add(b.invoiced),
    draftInvoiced: a.draftInvoiced.add(b.draftInvoiced),
    collected: a.collected.add(b.collected),
    outstanding: a.outstanding.add(b.outstanding),
    overdue: a.overdue.add(b.overdue),
    spent: a.spent.add(b.spent),
    pendingSpend: a.pendingSpend.add(b.pendingSpend),
    invoiceCount: a.invoiceCount + b.invoiceCount,
    overdueInvoiceCount: a.overdueInvoiceCount + b.overdueInvoiceCount,
    minutes: a.minutes + b.minutes,
  };
}

export function emptyFigures(): Figures {
  return computeFigures({
    budget: null,
    invoices: [],
    payments: [],
    expenses: [],
    transactions: [],
    minutes: 0,
    currency: '',
    now: new Date(0),
  });
}

export function serializeFigures(figures: Figures): ProjectMoneyFigures {
  const cashProfit = figures.collected.sub(figures.spent);
  const billedProfit = figures.invoiced.sub(figures.spent);
  return {
    budget: figures.budget ? money(figures.budget) : null,
    plannedCost: money(figures.plannedCost),
    invoiced: money(figures.invoiced),
    draftInvoiced: money(figures.draftInvoiced),
    collected: money(figures.collected),
    outstanding: money(figures.outstanding),
    overdue: money(figures.overdue),
    spent: money(figures.spent),
    pendingSpend: money(figures.pendingSpend),
    remainingBudget: figures.budget ? money(figures.budget.sub(figures.spent)) : null,
    cashProfit: money(cashProfit),
    billedProfit: money(billedProfit),
    marginPercent: percent(billedProfit, figures.invoiced),
    budgetUsedPercent: percent(figures.spent, figures.budget),
    collectionPercent: percent(figures.collected, figures.invoiced),
    hoursLogged: (figures.minutes / 60).toFixed(1),
  };
}

export function ageing(invoices: readonly MoneyInvoice[], now: Date): ProjectMoneyAgeing {
  const buckets = [ZERO, ZERO, ZERO, ZERO, ZERO];
  for (const invoice of invoices) {
    const owed = invoiceOutstanding(invoice);
    if (owed.lte(0)) continue;
    const days = daysOverdue(invoice, now);
    const index = days === 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
    buckets[index] = buckets[index]!.add(owed);
  }
  const [current, d30, d60, d90, d90plus] = buckets.map(money) as [
    string,
    string,
    string,
    string,
    string,
  ];
  return { current, days1to30: d30, days31to60: d60, days61to90: d90, days90plus: d90plus };
}

export function monthlySeries(
  input: Pick<FigureInputs, 'invoices' | 'payments' | 'expenses' | 'transactions' | 'currency'>,
  months: readonly string[],
): ProjectMoneyMonth[] {
  const rows = new Map(
    months.map((month) => [month, { moneyIn: ZERO, moneyOut: ZERO, invoiced: ZERO }]),
  );
  const add = (date: Date, key: 'moneyIn' | 'moneyOut' | 'invoiced', amount: Decimal): void => {
    const row = rows.get(businessMonth(date));
    if (row) row[key] = row[key].add(amount);
  };
  for (const invoice of input.invoices) {
    if (BILLED_STATUSES.has(invoice.status)) add(invoice.issueDate, 'invoiced', invoice.total);
  }
  for (const payment of input.payments) {
    if (payment.status === 'COMPLETED') add(payment.date, 'moneyIn', payment.amount);
  }
  for (const expense of input.expenses) {
    if (expenseCountsAsSpent(expense)) add(expense.date, 'moneyOut', expense.amount);
  }
  for (const tx of input.transactions) {
    if (!transactionCounts(tx, input.currency)) continue;
    add(tx.date, tx.type === 'INCOME' ? 'moneyIn' : 'moneyOut', tx.amount);
  }
  return months.map((month) => {
    const row = rows.get(month)!;
    return {
      month,
      moneyIn: money(row.moneyIn),
      moneyOut: money(row.moneyOut),
      invoiced: money(row.invoiced),
    };
  });
}

export function groupBy<T>(items: readonly T[], key: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    if (value === null) continue;
    const list = map.get(value);
    if (list) list.push(item);
    else map.set(value, [item]);
  }
  return map;
}
