import { Router, type NextFunction, type Request, type Response } from 'express';
import { PERMISSIONS } from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbacAny } from '../middleware/rbac';
import { AppError, sendData } from '../lib/http';
import {
  REPORT_STATUS_OPTIONS,
  getReport,
  getReportOverview,
  listReportCatalog,
  reportToCsv,
  type ReportKey,
  type ReportQuery,
} from '../services/reports.service';

export const reportsRouter: Router = Router();
reportsRouter.use(requireAuth);
reportsRouter.use(
  rbacAny([
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.TASKS_READ,
    PERMISSIONS.ENGINEERING_READ,
    PERMISSIONS.ENGINEERING_MANAGE,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.PORTAL_READ,
    PERMISSIONS.INVOICES_READ,
  ]),
);

const filters: Partial<Record<ReportKey, readonly string[]>> = {
  projects: ['status', 'projectId', 'clientId', 'engineerId', 'search'],
  tasks: ['status', 'projectId', 'clientId', 'engineerId', 'search'],
  engineers: ['projectId', 'engineerId', 'search'],
  clients: ['status', 'clientId', 'search'],
  inquiries: ['status', 'search'],
  'project-inquiries': ['status', 'projectId', 'clientId', 'search'],
  bugs: ['status', 'projectId', 'engineerId', 'search'],
  portfolio: ['status', 'search'],
  articles: ['status', 'search'],
  audit: ['search'],
  'trial-balance': [],
  'receivables-aging': ['projectId', 'clientId', 'search'],
  'my-projects': ['status', 'projectId', 'search'],
  'my-invoices': ['status', 'projectId'],
};

function one(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new AppError('VALIDATION_ERROR', 400, `Invalid ${key}`);
  return value.trim();
}
function datePart(raw: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
    throw new AppError('VALIDATION_ERROR', 400, 'Dates must use YYYY-MM-DD');
  const date = new Date(`${raw}T00:00:00.000+03:00`);
  // Reject impossible calendar dates after converting back to Mogadishu time.
  if (
    Number.isNaN(date.getTime()) ||
    new Date(date.getTime() + 3 * 3600_000).toISOString().slice(0, 10) !== raw
  )
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid calendar date');
  return date;
}
function positiveInteger(
  value: string | undefined,
  fallback: number,
  max: number,
  name: string,
): number {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) throw new AppError('VALIDATION_ERROR', 400, `Invalid ${name}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max)
    throw new AppError('VALIDATION_ERROR', 400, `Invalid ${name}`);
  return number;
}
export function parseReportQuery(req: Request, key?: string, exportCsv = false): ReportQuery {
  const today = new Date();
  const end = new Date(today.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
  const defaultFrom = new Date(today.getTime() - 30 * 86_400_000 + 3 * 3600_000)
    .toISOString()
    .slice(0, 10);
  const from = datePart(one(req, 'from') || defaultFrom);
  const to = datePart(one(req, 'to') || end);
  // `to` is inclusive in the URL. The database predicate uses a half-open interval.
  const until = new Date(to.getTime() + 86_400_000);
  if (
    !Number.isFinite(until.getTime()) ||
    from >= until ||
    until.getTime() - from.getTime() > 731 * 86_400_000
  )
    throw new AppError('VALIDATION_ERROR', 400, 'Select a date range of at most two years');
  const query: ReportQuery = {
    from,
    to: until,
    page: exportCsv ? 1 : positiveInteger(one(req, 'page'), 1, 100_000, 'page'),
    pageSize: exportCsv ? 5001 : positiveInteger(one(req, 'pageSize'), 25, 100, 'pageSize'),
  };
  for (const name of ['status', 'projectId', 'clientId', 'engineerId', 'search'] as const) {
    const value = one(req, name);
    if (!value) continue;
    if (!key || !(filters[key as ReportKey] ?? []).includes(name))
      throw new AppError('VALIDATION_ERROR', 400, `Unsupported ${name} filter`);
    if (value.length > (name === 'search' ? 100 : 128))
      throw new AppError('VALIDATION_ERROR', 400, `${name} is too long`);
    query[name] = value;
  }
  if (query.status && !(REPORT_STATUS_OPTIONS[key as ReportKey] ?? []).includes(query.status))
    throw new AppError('VALIDATION_ERROR', 400, 'Unknown status');
  return query;
}

function actor(req: Request) {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return req.authUser;
}
function reportKey(req: Request): string {
  if (!req.params.key) throw new AppError('VALIDATION_ERROR', 400, 'Report key required');
  return req.params.key;
}
function handle(fn: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch(next);
  };
}

reportsRouter.get(
  '/catalog',
  handle((req, res) => {
    sendData(res, listReportCatalog(actor(req), req.financeMfaVerifiedAt));
  }),
);
reportsRouter.get(
  '/overview',
  handle(async (req, res) => {
    sendData(
      res,
      await getReportOverview(actor(req), parseReportQuery(req), req.financeMfaVerifiedAt),
    );
  }),
);
reportsRouter.get(
  '/:key.csv',
  handle(async (req, res) => {
    const key = reportKey(req);
    const result = await getReport(
      actor(req),
      key,
      parseReportQuery(req, key, true),
      req.financeMfaVerifiedAt,
    );
    if (result.meta.total > 5000)
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        'CSV export has more than 5000 rows; narrow the filters',
      );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="somwave-${result.key}.csv"`);
    res.send('\uFEFF' + reportToCsv(result.columns, result.rows));
  }),
);
reportsRouter.get(
  '/:key',
  handle(async (req, res) => {
    const key = reportKey(req);
    const result = await getReport(
      actor(req),
      key,
      parseReportQuery(req, key),
      req.financeMfaVerifiedAt,
    );
    const { meta, ...data } = result;
    sendData(res, data, 200, meta);
  }),
);
