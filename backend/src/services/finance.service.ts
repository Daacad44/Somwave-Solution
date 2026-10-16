import { Prisma, type FinanceAccount, type FinanceTransaction } from '@prisma/client';
import {
  createFinanceTransactionSchema,
  type CreateFinanceAccountInput,
  type CreateFinanceTransactionInput,
  type UpdateFinanceTransactionInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

const ZERO = new Prisma.Decimal(0);
type Tx = Prisma.TransactionClient;

export interface FinanceHistoryQuery {
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  accountId?: string;
  currency?: string;
  search?: string;
}

export interface TransactionHistoryQuery extends FinanceHistoryQuery {
  statuses?: FinanceTransaction['status'][];
  type?: FinanceTransaction['type'];
}

export interface JournalHistoryQuery extends FinanceHistoryQuery {
  sourceType?: 'FINANCE_TRANSACTION' | 'REVERSAL';
}

export function assertBalanced(lines: { debit: Prisma.Decimal; credit: Prisma.Decimal }[]): void {
  if (lines.length < 2)
    throw new AppError('VALIDATION_ERROR', 400, 'A journal needs at least two lines');
  let debit = ZERO;
  let credit = ZERO;
  for (const line of lines) {
    if (
      (line.debit.gt(0) && !line.credit.isZero()) ||
      (line.credit.gt(0) && !line.debit.isZero()) ||
      (line.credit.isZero() && line.debit.isZero()) ||
      line.credit.lt(0) ||
      line.debit.lt(0)
    ) {
      throw new AppError('VALIDATION_ERROR', 400, 'Each journal line needs one positive side');
    }
    debit = debit.add(line.debit);
    credit = credit.add(line.credit);
  }
  if (!debit.eq(credit))
    throw new AppError('VALIDATION_ERROR', 400, 'Debits and credits must balance');
}

function periodOf(date: Date): { year: number; month: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

async function lockOpenPeriod(tx: Tx, date: Date): Promise<void> {
  const { year, month } = periodOf(date);
  await tx.financePeriod.upsert({
    where: { year_month: { year, month } },
    create: { year, month },
    update: {},
  });
  const rows = await tx.$queryRaw<{ status: string }[]>`SELECT "status"::text AS "status"
    FROM "finance_periods" WHERE "year" = ${year} AND "month" = ${month} FOR UPDATE`;
  if (rows[0]?.status !== 'OPEN')
    throw new AppError('CONFLICT', 409, 'Accounting period is closed');
}

function accountRecord(account: FinanceAccount) {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    currency: account.currency,
    isActive: account.isActive,
    allowPosting: account.allowPosting,
    parentId: account.parentId,
  };
}

export async function listAccounts() {
  return (await prisma.financeAccount.findMany({ orderBy: { code: 'asc' } })).map(accountRecord);
}

export async function listLinkOptions() {
  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, clientId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.findMany({
      where: { deletedAt: null },
      select: { id: true, companyName: true },
      orderBy: { companyName: 'asc' },
    }),
  ]);
  return { projects, clients };
}

export async function createAccount(input: CreateFinanceAccountInput, actorId: string) {
  if (input.parentId) {
    const parent = await prisma.financeAccount.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.type !== input.type || !parent.isActive)
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        'Parent account must be active and have the same type',
      );
  }
  return prisma.$transaction(async (tx) => {
    const account = await tx.financeAccount.create({
      data: {
        code: input.code,
        name: input.name,
        type: input.type,
        currency: input.currency ?? null,
        parentId: input.parentId ?? null,
        allowPosting: input.allowPosting,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'finance.account.create',
        subjectType: 'FinanceAccount',
        subjectId: account.id,
        after: { code: account.code, name: account.name, type: account.type },
      },
    });
    return accountRecord(account);
  });
}

function transactionRecord(row: FinanceTransaction) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amount: row.amount.toFixed(2),
    currency: row.currency,
    category: row.category,
    description: row.description,
    occurredOn: row.occurredOn.toISOString(),
    cashAccountId: row.cashAccountId,
    offsetAccountId: row.offsetAccountId,
    paymentMethod: row.paymentMethod,
    externalRef: row.externalRef,
    projectId: row.projectId,
    clientId: row.clientId,
    counterparty: row.counterparty,
    createdById: row.createdById,
    reviewedById: row.reviewedById,
    reviewReason: row.reviewReason,
    postedJournalId: row.postedJournalId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTransactions(query: TransactionHistoryQuery) {
  const where: Prisma.FinanceTransactionWhereInput = {
    ...(query.statuses?.length ? { status: { in: query.statuses } } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.from || query.to
      ? {
          occurredOn: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lt: query.to } : {}),
          },
        }
      : {}),
    ...(query.accountId
      ? { OR: [{ cashAccountId: query.accountId }, { offsetAccountId: query.accountId }] }
      : {}),
    ...(query.currency ? { currency: query.currency } : {}),
    ...(query.search
      ? {
          AND: [
            {
              OR: [
                { category: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
                { counterparty: { contains: query.search, mode: 'insensitive' } },
                { externalRef: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          ],
        }
      : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.financeTransaction.count({ where }),
    prisma.financeTransaction.findMany({
      where,
      orderBy: [{ occurredOn: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return {
    data: rows.map(transactionRecord),
    meta: { page: query.page, pageSize: query.pageSize, total },
  };
}

async function validateTransactionInput(input: CreateFinanceTransactionInput): Promise<Date> {
  if (input.cashAccountId === input.offsetAccountId)
    throw new AppError('VALIDATION_ERROR', 400, 'Select two different accounts');
  const [cash, offset, project, client] = await Promise.all([
    prisma.financeAccount.findUnique({ where: { id: input.cashAccountId } }),
    prisma.financeAccount.findUnique({ where: { id: input.offsetAccountId } }),
    input.projectId
      ? prisma.project.findFirst({ where: { id: input.projectId, deletedAt: null } })
      : null,
    input.clientId
      ? prisma.client.findFirst({ where: { id: input.clientId, deletedAt: null } })
      : null,
  ]);
  if (
    !cash ||
    !offset ||
    !cash.isActive ||
    !offset.isActive ||
    !cash.allowPosting ||
    !offset.allowPosting ||
    cash.type !== 'ASSET' ||
    !(input.type === 'INCOME'
      ? offset.type === 'REVENUE'
      : offset.type === 'EXPENSE' || offset.type === 'DIRECT_COST') ||
    (cash.currency && cash.currency !== input.currency) ||
    (offset.currency && offset.currency !== input.currency)
  ) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Select active accounts with matching type and currency',
    );
  }
  if (input.projectId && !project) throw new AppError('VALIDATION_ERROR', 400, 'Project not found');
  if (input.clientId && !client) throw new AppError('VALIDATION_ERROR', 400, 'Client not found');
  if (project?.clientId && input.clientId && project.clientId !== input.clientId)
    throw new AppError('VALIDATION_ERROR', 400, 'Client does not belong to this project');
  const occurredOn = new Date(input.occurredOn);
  const existingPeriod = await prisma.financePeriod.findUnique({
    where: { year_month: periodOf(occurredOn) },
  });
  if (existingPeriod?.status === 'CLOSED')
    throw new AppError('CONFLICT', 409, 'Accounting period is closed');
  return occurredOn;
}

export async function createTransaction(input: CreateFinanceTransactionInput, actorId: string) {
  const occurredOn = await validateTransactionInput(input);
  return prisma.$transaction(async (tx) => {
    const row = await tx.financeTransaction.create({
      data: {
        type: input.type,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        category: input.category,
        description: input.description,
        occurredOn,
        cashAccountId: input.cashAccountId,
        offsetAccountId: input.offsetAccountId,
        paymentMethod: input.paymentMethod ?? null,
        externalRef: input.externalRef ?? null,
        counterparty: input.counterparty ?? null,
        projectId: input.projectId ?? null,
        clientId: input.clientId ?? null,
        createdById: actorId,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'finance.transaction.create',
        subjectType: 'FinanceTransaction',
        subjectId: row.id,
        after: { type: row.type, amount: row.amount.toString(), currency: row.currency },
      },
    });
    return transactionRecord(row);
  });
}

export async function updateTransaction(
  id: string,
  patch: UpdateFinanceTransactionInput,
  actorId: string,
) {
  const current = await prisma.financeTransaction.findUnique({ where: { id } });
  if (
    !current ||
    current.createdById !== actorId ||
    (current.status !== 'DRAFT' && current.status !== 'REJECTED')
  )
    throw new AppError(
      'CONFLICT',
      409,
      'Only the creator can edit a draft or rejected transaction',
    );
  const parsed = createFinanceTransactionSchema.safeParse({
    type: current.type,
    amount: current.amount.toFixed(2),
    currency: current.currency,
    category: current.category,
    description: current.description,
    occurredOn: current.occurredOn.toISOString(),
    cashAccountId: current.cashAccountId,
    offsetAccountId: current.offsetAccountId,
    paymentMethod: current.paymentMethod,
    externalRef: current.externalRef,
    counterparty: current.counterparty,
    projectId: current.projectId,
    clientId: current.clientId,
    ...patch,
  });
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 400, 'Invalid transaction changes');
  const input = parsed.data;
  const occurredOn = await validateTransactionInput(input);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.financeTransaction.updateMany({
      where: {
        id,
        createdById: actorId,
        status: { in: ['DRAFT', 'REJECTED'] },
        updatedAt: current.updatedAt,
      },
      data: {
        type: input.type,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        category: input.category,
        description: input.description,
        occurredOn,
        cashAccountId: input.cashAccountId,
        offsetAccountId: input.offsetAccountId,
        paymentMethod: input.paymentMethod ?? null,
        externalRef: input.externalRef ?? null,
        counterparty: input.counterparty ?? null,
        projectId: input.projectId ?? null,
        clientId: input.clientId ?? null,
        status: 'DRAFT',
        reviewedById: null,
        reviewedAt: null,
        reviewReason: null,
      },
    });
    if (!claimed.count)
      throw new AppError('CONFLICT', 409, 'Transaction changed; refresh and try again');
    const updated = await tx.financeTransaction.findUniqueOrThrow({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'finance.transaction.update',
        subjectType: 'FinanceTransaction',
        subjectId: id,
        before: transactionRecord(current),
        after: transactionRecord(updated),
      },
    });
    return transactionRecord(updated);
  });
}

export async function cancelTransaction(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.financeTransaction.updateMany({
      where: { id, createdById: actorId, status: { in: ['DRAFT', 'SUBMITTED', 'REJECTED'] } },
      data: { status: 'CANCELLED' },
    });
    if (!claimed.count)
      throw new AppError('CONFLICT', 409, 'Only the creator can cancel an unapproved transaction');
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'finance.transaction.cancel',
        subjectType: 'FinanceTransaction',
        subjectId: id,
      },
    });
    return transactionRecord(await tx.financeTransaction.findUniqueOrThrow({ where: { id } }));
  });
}

export async function submitTransaction(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.financeTransaction.updateMany({
      where: { id, createdById: actorId, status: { in: ['DRAFT', 'REJECTED'] } },
      data: { status: 'SUBMITTED', reviewedById: null, reviewedAt: null, reviewReason: null },
    });
    if (!claimed.count)
      throw new AppError('CONFLICT', 409, 'Only the creator can submit an editable transaction');
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'finance.transaction.submit',
        subjectType: 'FinanceTransaction',
        subjectId: id,
      },
    });
    return transactionRecord(await tx.financeTransaction.findUniqueOrThrow({ where: { id } }));
  });
}

export async function reviewTransaction(
  id: string,
  actorId: string,
  approve: boolean,
  reason?: string,
) {
  if (!approve && !reason)
    throw new AppError('VALIDATION_ERROR', 400, 'A rejection reason is required');
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.financeTransaction.updateMany({
      where: { id, status: 'SUBMITTED', createdById: { not: actorId } },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        reviewedById: actorId,
        reviewedAt: new Date(),
        reviewReason: reason ?? null,
      },
    });
    if (!claimed.count)
      throw new AppError(
        'CONFLICT',
        409,
        'Transaction is unavailable or self-approval is prohibited',
      );
    await tx.auditLog.create({
      data: {
        actorId,
        action: approve ? 'finance.transaction.approve' : 'finance.transaction.reject',
        subjectType: 'FinanceTransaction',
        subjectId: id,
        after: { reason: reason ?? null },
      },
    });
    return transactionRecord(await tx.financeTransaction.findUniqueOrThrow({ where: { id } }));
  });
}

export async function postTransaction(id: string, actorId: string) {
  return prisma.$transaction(
    async (tx) => {
      const row = await tx.financeTransaction.findUnique({ where: { id } });
      if (
        !row ||
        row.status !== 'APPROVED' ||
        !row.reviewedById ||
        row.reviewedById === row.createdById
      )
        throw new AppError('CONFLICT', 409, 'A separate reviewer must approve before posting');
      const [cash, offset] = await Promise.all([
        tx.financeAccount.findUnique({ where: { id: row.cashAccountId } }),
        tx.financeAccount.findUnique({ where: { id: row.offsetAccountId } }),
      ]);
      if (
        !cash?.isActive ||
        !cash.allowPosting ||
        !offset?.isActive ||
        !offset.allowPosting ||
        cash.type !== 'ASSET' ||
        !(row.type === 'INCOME'
          ? offset.type === 'REVENUE'
          : offset.type === 'EXPENSE' || offset.type === 'DIRECT_COST') ||
        (cash.currency && cash.currency !== row.currency) ||
        (offset.currency && offset.currency !== row.currency)
      )
        throw new AppError('CONFLICT', 409, 'Finance accounts are no longer valid for posting');
      await lockOpenPeriod(tx, row.occurredOn);
      const amount = row.amount;
      const lines =
        row.type === 'INCOME'
          ? [
              { accountId: row.cashAccountId, debit: amount, credit: ZERO },
              { accountId: row.offsetAccountId, debit: ZERO, credit: amount },
            ]
          : [
              { accountId: row.offsetAccountId, debit: amount, credit: ZERO },
              { accountId: row.cashAccountId, debit: ZERO, credit: amount },
            ];
      assertBalanced(lines);
      const journal = await tx.financeJournal.create({
        data: {
          reference: `FIN-${row.id}`,
          occurredOn: row.occurredOn,
          currency: row.currency,
          memo: row.description,
          sourceType: 'FINANCE_TRANSACTION',
          sourceId: row.id,
          createdById: actorId,
          lines: {
            create: lines.map((line) => ({
              ...line,
              projectId: row.projectId,
              clientId: row.clientId,
            })),
          },
        },
      });
      await tx.financeJournal.update({ where: { id: journal.id }, data: { isFinalized: true } });
      const claimed = await tx.financeTransaction.updateMany({
        where: { id, status: 'APPROVED', postedJournalId: null },
        data: { status: 'POSTED', postedJournalId: journal.id },
      });
      if (!claimed.count) throw new AppError('CONFLICT', 409, 'Transaction was already posted');
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'finance.transaction.post',
          subjectType: 'FinanceTransaction',
          subjectId: id,
          after: { journalId: journal.id, amount: amount.toString(), currency: row.currency },
        },
      });
      return transactionRecord(await tx.financeTransaction.findUniqueOrThrow({ where: { id } }));
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function reverseJournal(id: string, actorId: string, reason: string) {
  return prisma.$transaction(
    async (tx) => {
      const original = await tx.financeJournal.findUnique({
        where: { id },
        include: { lines: true, reversedBy: true },
      });
      if (!original || !original.isFinalized)
        throw new AppError('NOT_FOUND', 404, 'Posted journal not found');
      if (original.reversedBy || original.reversesJournalId)
        throw new AppError(
          'CONFLICT',
          409,
          'Journal has already been reversed or is itself a reversal',
        );
      const occurredOn = new Date();
      await lockOpenPeriod(tx, occurredOn);
      const lines = original.lines.map((line) => ({
        accountId: line.accountId,
        debit: line.credit,
        credit: line.debit,
        projectId: line.projectId,
        clientId: line.clientId,
      }));
      assertBalanced(lines);
      const reversal = await tx.financeJournal.create({
        data: {
          reference: `REV-${original.id}`,
          occurredOn,
          currency: original.currency,
          memo: `Reversal: ${reason}`,
          sourceType: 'REVERSAL',
          sourceId: original.id,
          reversesJournalId: original.id,
          createdById: actorId,
          lines: { create: lines },
        },
      });
      await tx.financeJournal.update({ where: { id: reversal.id }, data: { isFinalized: true } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'finance.journal.reverse',
          subjectType: 'FinanceJournal',
          subjectId: original.id,
          after: { reversalId: reversal.id, reason },
        },
      });
      return { id: reversal.id, reference: reversal.reference };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function closePeriod(year: number, month: number, actorId: string) {
  const current = periodOf(new Date());
  if (year > current.year || (year === current.year && month > current.month))
    throw new AppError('VALIDATION_ERROR', 400, 'A future accounting period cannot be closed');
  return prisma.$transaction(
    async (tx) => {
      await tx.financePeriod.upsert({
        where: { year_month: { year, month } },
        create: { year, month },
        update: {},
      });
      const rows = await tx.$queryRaw<{ status: string }[]>`SELECT "status"::text AS "status"
      FROM "finance_periods" WHERE "year" = ${year} AND "month" = ${month} FOR UPDATE`;
      if (rows[0]?.status !== 'OPEN')
        throw new AppError('CONFLICT', 409, 'Period is already closed');
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      const pending = await tx.financeTransaction.count({
        where: {
          occurredOn: { gte: start, lt: end },
          status: { in: ['SUBMITTED', 'APPROVED'] },
        },
      });
      if (pending)
        throw new AppError(
          'CONFLICT',
          409,
          'Resolve submitted and approved transactions before closing',
        );
      const period = await tx.financePeriod.update({
        where: { year_month: { year, month } },
        data: { status: 'CLOSED', closedById: actorId, closedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'finance.period.close',
          subjectType: 'FinancePeriod',
          subjectId: period.id,
          after: { year, month },
        },
      });
      return { year, month, status: period.status, closedAt: period.closedAt?.toISOString() };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

type BalanceRow = {
  code: string;
  name: string;
  type: string;
  currency: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
};

export async function trialBalance(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<BalanceRow[]>`
    SELECT a."code", a."name", a."type"::text AS "type", j."currency",
      SUM(l."debit") AS "debit", SUM(l."credit") AS "credit"
    FROM "finance_journal_lines" l
    JOIN "finance_journals" j ON j."id" = l."journal_id"
    JOIN "finance_accounts" a ON a."id" = l."account_id"
    WHERE j."is_finalized" = true AND j."occurred_on" >= ${from}
      AND j."occurred_on" < ${to}
    GROUP BY a."code", a."name", a."type", j."currency"
    ORDER BY a."code", j."currency"`;
  return rows.map((row) => ({
    ...row,
    debit: row.debit.toFixed(2),
    credit: row.credit.toFixed(2),
    balance: row.debit.sub(row.credit).toFixed(2),
  }));
}

export async function financeDashboard(from: Date, to: Date) {
  const rows = await trialBalance(from, to);
  const byCurrency = new Map<
    string,
    {
      currency: string;
      revenue: Prisma.Decimal;
      expenses: Prisma.Decimal;
      netProfit: Prisma.Decimal;
      debits: Prisma.Decimal;
      credits: Prisma.Decimal;
    }
  >();
  for (const row of rows) {
    const item = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      revenue: ZERO,
      expenses: ZERO,
      netProfit: ZERO,
      debits: ZERO,
      credits: ZERO,
    };
    const debit = new Prisma.Decimal(row.debit);
    const credit = new Prisma.Decimal(row.credit);
    item.debits = item.debits.add(debit);
    item.credits = item.credits.add(credit);
    if (row.type === 'REVENUE') item.revenue = item.revenue.add(credit.sub(debit));
    if (row.type === 'EXPENSE' || row.type === 'DIRECT_COST')
      item.expenses = item.expenses.add(debit.sub(credit));
    item.netProfit = item.revenue.sub(item.expenses);
    byCurrency.set(row.currency, item);
  }
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    basis:
      'Posted finance journals only; legacy invoices and payments are not yet reconciled into the ledger',
    currencies: [...byCurrency.values()].map((row) => ({
      currency: row.currency,
      revenue: row.revenue.toFixed(2),
      expenses: row.expenses.toFixed(2),
      netProfit: row.netProfit.toFixed(2),
      debits: row.debits.toFixed(2),
      credits: row.credits.toFixed(2),
      balanced: row.debits.eq(row.credits),
    })),
  };
}

type ProjectBalanceRow = {
  projectId: string;
  projectName: string;
  currency: string;
  type: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
};
export async function projectProfitability(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<ProjectBalanceRow[]>`
    SELECT p."id" AS "projectId", p."name" AS "projectName",
      j."currency", a."type"::text AS "type",
      SUM(l."debit") AS "debit", SUM(l."credit") AS "credit"
    FROM "finance_journal_lines" l
    JOIN "finance_journals" j ON j."id" = l."journal_id"
    JOIN "finance_accounts" a ON a."id" = l."account_id"
    JOIN "projects" p ON p."id" = l."project_id"
    WHERE j."is_finalized" = true AND j."occurred_on" >= ${from}
      AND j."occurred_on" < ${to}
      AND a."type" IN ('REVENUE', 'DIRECT_COST', 'EXPENSE')
    GROUP BY p."id", p."name", j."currency", a."type"
    ORDER BY p."name", j."currency"`;
  const grouped = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      currency: string;
      revenue: Prisma.Decimal;
      directCosts: Prisma.Decimal;
      operatingExpenses: Prisma.Decimal;
    }
  >();
  for (const row of rows) {
    const key = `${row.projectId}:${row.currency}`;
    const value = grouped.get(key) ?? {
      projectId: row.projectId,
      projectName: row.projectName,
      currency: row.currency,
      revenue: ZERO,
      directCosts: ZERO,
      operatingExpenses: ZERO,
    };
    if (row.type === 'REVENUE') value.revenue = value.revenue.add(row.credit.sub(row.debit));
    if (row.type === 'DIRECT_COST')
      value.directCosts = value.directCosts.add(row.debit.sub(row.credit));
    if (row.type === 'EXPENSE')
      value.operatingExpenses = value.operatingExpenses.add(row.debit.sub(row.credit));
    grouped.set(key, value);
  }
  return [...grouped.values()].map((row) => {
    const grossProfit = row.revenue.sub(row.directCosts);
    const netProfit = grossProfit.sub(row.operatingExpenses);
    return {
      projectId: row.projectId,
      projectName: row.projectName,
      currency: row.currency,
      revenue: row.revenue.toFixed(2),
      directCosts: row.directCosts.toFixed(2),
      operatingExpenses: row.operatingExpenses.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      netProfit: netProfit.toFixed(2),
      marginPercent: row.revenue.isZero()
        ? null
        : netProfit.div(row.revenue).mul(100).toDecimalPlaces(1).toFixed(1),
    };
  });
}

export async function listJournals(query: JournalHistoryQuery) {
  const where: Prisma.FinanceJournalWhereInput = {
    isFinalized: true,
    ...(query.from || query.to
      ? {
          occurredOn: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lt: query.to } : {}),
          },
        }
      : {}),
    ...(query.accountId ? { lines: { some: { accountId: query.accountId } } } : {}),
    ...(query.currency ? { currency: query.currency } : {}),
    ...(query.sourceType ? { sourceType: query.sourceType } : {}),
    ...(query.search
      ? {
          OR: [
            { reference: { contains: query.search, mode: 'insensitive' } },
            { memo: { contains: query.search, mode: 'insensitive' } },
            { sourceId: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.financeJournal.count({ where }),
    prisma.financeJournal.findMany({
      where,
      orderBy: [{ occurredOn: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        lines: { include: { account: { select: { code: true, name: true } } } },
        reversedBy: { select: { id: true } },
      },
    }),
  ]);
  const data = rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    occurredOn: row.occurredOn.toISOString(),
    currency: row.currency,
    memo: row.memo,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    reversesJournalId: row.reversesJournalId,
    reversedById: row.reversedBy?.id ?? null,
    lines: row.lines.map((line) => ({
      id: line.id,
      accountId: line.accountId,
      accountCode: line.account.code,
      accountName: line.account.name,
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
      projectId: line.projectId,
    })),
  }));
  return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}
