import { randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  DEFAULT_PAGE_SIZE,
  financeBusinessDate,
  parseFinanceBusinessDate,
  MAX_PAGE_SIZE,
  PERMISSIONS,
  createFinanceAccountSchema,
  createFinanceTransactionSchema,
  financeReviewSchema,
  updateFinanceTransactionSchema,
  closeFinancePeriodSchema,
  projectMoneyQuerySchema,
  type CreateFinanceAccountInput,
  type CreateFinanceTransactionInput,
  type UpdateFinanceTransactionInput,
} from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AppError, sendData } from '../lib/http';
import { logger } from '../lib/logger';
import * as finance from '../services/finance.service';
import * as projectMoney from '../services/project-money.service';

export const financeRouter: Router = Router();
financeRouter.use((req, res, next) => {
  const started = performance.now();
  const endpoint = `${req.baseUrl}${req.path}`;
  const requestId = req.id ?? randomUUID();
  res.on('finish', () => {
    logger.info(
      {
        requestId,
        endpoint,
        roles: req.authUser?.roles ?? [],
        status: res.statusCode,
        durationMs: Math.round(performance.now() - started),
        category:
          res.statusCode >= 500
            ? 'server_error'
            : res.statusCode === 403
              ? 'access_denied'
              : res.statusCode >= 400
                ? 'request_error'
                : 'success',
      },
      'Finance request completed',
    );
  });
  next();
});
financeRouter.use(requireAuth);
export function requireFinanceTwoFactor(req: Request, _res: Response, next: NextFunction): void {
  if (!req.authUser?.twoFactorEnabled || !req.financeMfaVerifiedAt) {
    next(
      req.authUser?.twoFactorEnabled
        ? new AppError('FORBIDDEN', 403, 'Confirm your two-factor code to open finance', {
            reason: 'FINANCE_MFA_STEP_UP_REQUIRED',
          })
        : new AppError(
            'FORBIDDEN',
            403,
            'Enable two-factor authentication in Security settings before accessing finance',
            { reason: 'FINANCE_2FA_NOT_ENROLLED' },
          ),
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
export function reportDates(req: Request): { from: Date; to: Date } {
  const today = financeBusinessDate();
  const [year, month] = today.split('-').map(Number) as [number, number, number];
  const start = req.query.from ?? `${today.slice(0, 7)}-01`;
  const end = req.query.to ?? new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  if (typeof start !== 'string' || typeof end !== 'string')
    throw new AppError('VALIDATION_ERROR', 400, 'Use YYYY-MM-DD dates');
  const from = historyDate(start);
  const to = historyDate(end);
  if (from >= to) throw new AppError('VALIDATION_ERROR', 400, 'End date must follow start date');
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
  const date = parseFinanceBusinessDate(raw);
  if (!date) throw new AppError('VALIDATION_ERROR', 400, 'Use a valid YYYY-MM-DD accounting date');
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
function projectMoneyQuery(req: Request) {
  const parsed = projectMoneyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid project money filters', {
      fields: parsed.error.flatten().fieldErrors,
    });
  }
  return parsed.data;
}
// Every project's money from source records, including pre-ledger history.
financeRouter.get(
  '/projects-money',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (req, res) => {
    sendData(res, await projectMoney.projectMoneyOverview(projectMoneyQuery(req)));
  }),
);
financeRouter.get(
  '/projects-money.csv',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (req, res) => {
    const overview = await projectMoney.projectMoneyOverview(projectMoneyQuery(req));
    const header = [
      'Project',
      'Client',
      'Status',
      'Health',
      `Budget (${overview.currency})`,
      'Planned cost',
      'Invoiced',
      'Collected',
      'Outstanding',
      'Overdue',
      'Spent',
      'Pending spend',
      'Remaining budget',
      'Cash profit',
      'Margin %',
      'Budget used %',
      'Hours logged',
    ];
    const csv = [
      header.map(csvCell).join(','),
      ...overview.projects.map((row) =>
        [
          ...[row.projectName, row.clientName ?? '', row.status, row.health].map(csvCell),
          row.budget ?? '',
          row.plannedCost,
          row.invoiced,
          row.collected,
          row.outstanding,
          row.overdue,
          row.spent,
          row.pendingSpend,
          row.remainingBudget ?? '',
          row.cashProfit,
          row.marginPercent ?? '',
          row.budgetUsedPercent ?? '',
          row.hoursLogged,
        ].join(','),
      ),
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="somwave-projects-money.csv"');
    res.status(200).send(`\uFEFF${csv}\r\n`);
  }),
);
financeRouter.get(
  '/projects-money/:projectId',
  rbac(PERMISSIONS.FINANCE_READ),
  handle(async (req, res) => {
    const projectId = req.params.projectId;
    if (!projectId) throw new AppError('VALIDATION_ERROR', 400, 'Project ID required');
    sendData(res, await projectMoney.projectMoneyDetail(projectId));
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
