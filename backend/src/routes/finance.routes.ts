import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PERMISSIONS,
  createFinanceAccountSchema,
  createFinanceTransactionSchema,
  financeReviewSchema,
  updateFinanceTransactionSchema,
  closeFinancePeriodSchema,
  type CreateFinanceAccountInput,
  type CreateFinanceTransactionInput,
  type UpdateFinanceTransactionInput,
} from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AppError, sendData } from '../lib/http';
import * as finance from '../services/finance.service';

export const financeRouter: Router = Router();
financeRouter.use(requireAuth);
export function requireFinanceTwoFactor(req: Request, _res: Response, next: NextFunction): void {
  if (!req.authUser?.twoFactorEnabled || !req.financeMfaVerifiedAt) {
    next(
      new AppError('FORBIDDEN', 403, 'Enable two-factor authentication before accessing finance'),
    );
    return;
  }
  next();
}
financeRouter.use(requireFinanceTwoFactor);

function actor(req: Request): string {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return req.authUser.id;
}
function id(req: Request): string {
  if (!req.params.id) throw new AppError('VALIDATION_ERROR', 400, 'Record ID required');
  return req.params.id;
}
function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res).catch(next);
  };
}
function reportDates(req: Request): { from: Date; to: Date } {
  const now = new Date();
  const start =
    req.query.from ??
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const end =
    req.query.to ??
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  if (
    typeof start !== 'string' ||
    typeof end !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end)
  )
    throw new AppError('VALIDATION_ERROR', 400, 'Use YYYY-MM-DD dates');
  const from = new Date(`${start}T00:00:00.000Z`);
  const to = new Date(`${end}T00:00:00.000Z`);
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from.toISOString().slice(0, 10) !== start ||
    to.toISOString().slice(0, 10) !== end ||
    from >= to
  )
    throw new AppError('VALIDATION_ERROR', 400, 'Select a valid accounting date range');
  return { from, to };
}
function csvCell(value: string): string {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

type FinanceHistoryKind = 'transactions' | 'journals';
function historyValue(req: Request, name: string): string | undefined {
  const raw = req.query[name];
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || raw.trim().length === 0)
    throw new AppError('VALIDATION_ERROR', 400, `Invalid ${name}`);
  return raw.trim();
}
function historyDate(raw: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
    throw new AppError('VALIDATION_ERROR', 400, 'Use YYYY-MM-DD dates');
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw)
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid accounting date');
  return date;
}
function historyInteger(raw: string | undefined, fallback: number, maximum: number): number {
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) throw new AppError('VALIDATION_ERROR', 400, 'Invalid pagination');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum)
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid pagination');
  return value;
}
export function parseFinanceHistoryQuery(
  req: Request,
  kind: 'transactions',
): finance.TransactionHistoryQuery;
export function parseFinanceHistoryQuery(
  req: Request,
  kind: 'journals',
): finance.JournalHistoryQuery;
export function parseFinanceHistoryQuery(
  req: Request,
  kind: FinanceHistoryKind,
): finance.TransactionHistoryQuery | finance.JournalHistoryQuery {
  const allowed = new Set([
    'page',
    'pageSize',
    'from',
    'to',
    'accountId',
    'currency',
    'search',
    ...(kind === 'transactions' ? ['status', 'type'] : ['sourceType']),
  ]);
  for (const key of Object.keys(req.query)) {
    if (!allowed.has(key)) throw new AppError('VALIDATION_ERROR', 400, `Unsupported ${key} filter`);
  }
  const page = historyInteger(historyValue(req, 'page'), 1, 10_000);
  const pageSize = historyInteger(historyValue(req, 'pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const fromRaw = historyValue(req, 'from');
  const toRaw = historyValue(req, 'to');
  const from = fromRaw ? historyDate(fromRaw) : undefined;
  const to = toRaw ? historyDate(toRaw) : undefined;
  if (from && to && from >= to)
    throw new AppError('VALIDATION_ERROR', 400, 'End date must follow start date');
  const accountId = historyValue(req, 'accountId');
  if (accountId && accountId.length > 128)
    throw new AppError('VALIDATION_ERROR', 400, 'Account ID is too long');
  const currency = historyValue(req, 'currency');
  if (currency && !/^[A-Z]{3}$/.test(currency))
    throw new AppError('VALIDATION_ERROR', 400, 'Use a three-letter currency code');
  const search = historyValue(req, 'search');
  if (search && search.length > 100)
    throw new AppError('VALIDATION_ERROR', 400, 'Search is too long');
  const common = { page, pageSize, from, to, accountId, currency, search };
  if (kind === 'journals') {
    const sourceType = historyValue(req, 'sourceType');
    if (sourceType && sourceType !== 'FINANCE_TRANSACTION' && sourceType !== 'REVERSAL')
      throw new AppError('VALIDATION_ERROR', 400, 'Unknown journal source');
    return { ...common, sourceType: sourceType as finance.JournalHistoryQuery['sourceType'] };
  }
  const type = historyValue(req, 'type');
  if (type && type !== 'INCOME' && type !== 'EXPENSE')
    throw new AppError('VALIDATION_ERROR', 400, 'Unknown transaction type');
  const status = historyValue(req, 'status');
  const statuses = status?.split(',');
  const known = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED'] as const;
  if (statuses?.some((item) => !known.some((value) => value === item)))
    throw new AppError('VALIDATION_ERROR', 400, 'Unknown transaction status');
  return {
    ...common,
    type: type as finance.TransactionHistoryQuery['type'],
    statuses: statuses as finance.TransactionHistoryQuery['statuses'],
  };
}

financeRouter.get(
  '/accounts',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (_req, res) => {
    sendData(res, await finance.listAccounts());
  }),
);
financeRouter.get(
  '/link-options',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (_req, res) => {
    sendData(res, await finance.listLinkOptions());
  }),
);
financeRouter.post(
  '/accounts',
  rbac(PERMISSIONS.FINANCE_MANAGE),
  validate(createFinanceAccountSchema),
  handle(async (req, res) => {
    sendData(
      res,
      await finance.createAccount(req.body as CreateFinanceAccountInput, actor(req)),
      201,
    );
  }),
);
financeRouter.get(
  '/transactions',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (req, res) => {
    const result = await finance.listTransactions(parseFinanceHistoryQuery(req, 'transactions'));
    sendData(res, result.data, 200, result.meta);
  }),
);
financeRouter.post(
  '/transactions',
  rbac(PERMISSIONS.FINANCE_CREATE),
  validate(createFinanceTransactionSchema),
  handle(async (req, res) => {
    sendData(
      res,
      await finance.createTransaction(req.body as CreateFinanceTransactionInput, actor(req)),
      201,
    );
  }),
);
financeRouter.patch(
  '/transactions/:id',
  rbac(PERMISSIONS.FINANCE_CREATE),
  validate(updateFinanceTransactionSchema),
  handle(async (req, res) => {
    sendData(
      res,
      await finance.updateTransaction(
        id(req),
        req.body as UpdateFinanceTransactionInput,
        actor(req),
      ),
    );
  }),
);
financeRouter.post(
  '/transactions/:id/cancel',
  rbac(PERMISSIONS.FINANCE_CREATE),
  handle(async (req, res) => {
    sendData(res, await finance.cancelTransaction(id(req), actor(req)));
  }),
);
financeRouter.post(
  '/transactions/:id/submit',
  rbac(PERMISSIONS.FINANCE_CREATE),
  handle(async (req, res) => {
    sendData(res, await finance.submitTransaction(id(req), actor(req)));
  }),
);
financeRouter.post(
  '/transactions/:id/approve',
  rbac(PERMISSIONS.FINANCE_APPROVE),
  validate(financeReviewSchema),
  handle(async (req, res) => {
    sendData(res, await finance.reviewTransaction(id(req), actor(req), true, req.body.reason));
  }),
);
financeRouter.post(
  '/transactions/:id/reject',
  rbac(PERMISSIONS.FINANCE_APPROVE),
  validate(financeReviewSchema),
  handle(async (req, res) => {
    sendData(res, await finance.reviewTransaction(id(req), actor(req), false, req.body.reason));
  }),
);
financeRouter.post(
  '/transactions/:id/post',
  rbac(PERMISSIONS.FINANCE_POST),
  handle(async (req, res) => {
    sendData(res, await finance.postTransaction(id(req), actor(req)));
  }),
);
financeRouter.get(
  '/journals',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (req, res) => {
    const result = await finance.listJournals(parseFinanceHistoryQuery(req, 'journals'));
    sendData(res, result.data, 200, result.meta);
  }),
);
financeRouter.post(
  '/journals/:id/reverse',
  rbac(PERMISSIONS.FINANCE_MANAGE),
  validate(financeReviewSchema),
  handle(async (req, res) => {
    if (!req.body.reason) throw new AppError('VALIDATION_ERROR', 400, 'Reversal reason required');
    sendData(res, await finance.reverseJournal(id(req), actor(req), req.body.reason), 201);
  }),
);
financeRouter.get(
  '/trial-balance',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (req, res) => {
    const { from, to } = reportDates(req);
    sendData(res, await finance.trialBalance(from, to));
  }),
);
financeRouter.get(
  '/trial-balance.csv',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (req, res) => {
    const { from, to } = reportDates(req);
    const rows = await finance.trialBalance(from, to);
    const header = [
      'Account code',
      'Account name',
      'Type',
      'Currency',
      'Debit',
      'Credit',
      'Net debit',
    ];
    const csv = [
      header.map(csvCell).join(','),
      ...rows.map((row) =>
        [
          ...[row.code, row.name, row.type, row.currency].map(csvCell),
          row.debit,
          row.credit,
          row.balance,
        ].join(','),
      ),
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="somwave-trial-balance.csv"');
    res.status(200).send(`\uFEFF${csv}\r\n`);
  }),
);
financeRouter.get(
  '/dashboard',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (req, res) => {
    const { from, to } = reportDates(req);
    sendData(res, await finance.financeDashboard(from, to));
  }),
);
financeRouter.get(
  '/project-profitability',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (req, res) => {
    const { from, to } = reportDates(req);
    sendData(res, await finance.projectProfitability(from, to));
  }),
);
financeRouter.post(
  '/periods/close',
  rbac(PERMISSIONS.FINANCE_MANAGE),
  validate(closeFinancePeriodSchema),
  handle(async (req, res) => {
    sendData(res, await finance.closePeriod(req.body.year, req.body.month, actor(req)));
  }),
);
