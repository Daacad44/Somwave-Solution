// Project money read model (I8.B interim). Every figure is derived from the
// source records — invoices, payments, project expenses, finance transactions,
// budgets and logged time — so all projects, including those recorded before
// the ledger existed, are visible in Finance Management without re-entry.
// Amounts are decimal strings; the API never sends money as a JS number.
import { z } from 'zod';

export const PROJECT_MONEY_HEALTH = ['ON_TRACK', 'AT_RISK', 'OVER_BUDGET', 'NO_BUDGET'] as const;
export type ProjectMoneyHealth = (typeof PROJECT_MONEY_HEALTH)[number];

export const PROJECT_MONEY_SORT = [
  'name',
  'budget',
  'invoiced',
  'collected',
  'outstanding',
  'spent',
  'profit',
  'budgetUsed',
] as const;

export const projectMoneyQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  health: z.enum(PROJECT_MONEY_HEALTH).optional(),
  sort: z.enum(PROJECT_MONEY_SORT).default('outstanding'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});
export type ProjectMoneyQuery = z.infer<typeof projectMoneyQuerySchema>;

/** The money figures shared by a project row, the company totals and the project page. */
export interface ProjectMoneyFigures {
  budget: string | null;
  plannedCost: string;
  invoiced: string;
  draftInvoiced: string;
  collected: string;
  outstanding: string;
  overdue: string;
  spent: string;
  pendingSpend: string;
  remainingBudget: string | null;
  /** collected − spent */
  cashProfit: string;
  /** invoiced − spent */
  billedProfit: string;
  /** billedProfit / invoiced, one decimal, null when nothing is invoiced */
  marginPercent: string | null;
  /** spent / budget, one decimal, null without a budget */
  budgetUsedPercent: string | null;
  /** collected / invoiced, one decimal, null when nothing is invoiced */
  collectionPercent: string | null;
  hoursLogged: string;
}

export interface ProjectMoneyRow extends ProjectMoneyFigures {
  projectId: string;
  projectName: string;
  status: string;
  clientId: string | null;
  clientName: string | null;
  health: ProjectMoneyHealth;
  invoiceCount: number;
  overdueInvoiceCount: number;
}

export interface ProjectMoneyCategory {
  category: string;
  planned: string;
  spent: string;
  projects: { projectId: string; projectName: string; spent: string }[];
}

export interface ProjectMoneyMonth {
  month: string; // YYYY-MM
  moneyIn: string;
  moneyOut: string;
  invoiced: string;
}

export interface ProjectMoneyAgeing {
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  days90plus: string;
}

export interface ProjectMoneyOverview {
  currency: string;
  generatedAt: string;
  totals: ProjectMoneyFigures & {
    projectCount: number;
    projectsOverBudget: number;
    projectsAtRisk: number;
    projectsWithOverdue: number;
    unassigned: { invoiced: string; collected: string; outstanding: string };
  };
  projects: ProjectMoneyRow[];
  categories: ProjectMoneyCategory[];
  months: ProjectMoneyMonth[];
  ageing: ProjectMoneyAgeing;
  notes: string[];
}

export interface ProjectMoneyInvoice {
  id: string;
  number: string;
  status: string;
  issueDate: string;
  dueDate: string;
  total: string;
  paid: string;
  outstanding: string;
  daysOverdue: number;
}

export interface ProjectMoneyPayment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  method: string;
  status: string;
  reference: string | null;
  date: string;
}

export type ProjectMoneySpendSource = 'PROJECT_EXPENSE' | 'FINANCE_TRANSACTION';

export interface ProjectMoneySpend {
  id: string;
  source: ProjectMoneySpendSource;
  /** PLANNED | ACTUAL for project expenses; the transaction status otherwise */
  state: string;
  category: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  counterparty: string | null;
  countsAsSpent: boolean;
  possibleDuplicateOf: string | null;
}

export interface ProjectMoneyIncome {
  id: string;
  status: string;
  category: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  counterparty: string | null;
}

export interface ProjectMoneyDetail {
  currency: string;
  generatedAt: string;
  project: {
    id: string;
    name: string;
    status: string;
    clientId: string | null;
    clientName: string | null;
    managerName: string | null;
    startDate: string | null;
    dueDate: string | null;
  };
  figures: ProjectMoneyFigures;
  health: ProjectMoneyHealth;
  invoices: ProjectMoneyInvoice[];
  payments: ProjectMoneyPayment[];
  spending: ProjectMoneySpend[];
  otherIncome: ProjectMoneyIncome[];
  categories: { category: string; planned: string; spent: string }[];
  budgetHistory: {
    id: string;
    previousBudget: string | null;
    newBudget: string;
    reason: string;
    date: string;
  }[];
  hoursByPerson: { userId: string; name: string; hours: string }[];
  hoursByPhase: { phaseId: string | null; title: string; hours: string }[];
  timeline: {
    month: string;
    moneyIn: string;
    moneyOut: string;
    cumulativeIn: string;
    cumulativeOut: string;
  }[];
  notes: string[];
}
