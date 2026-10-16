import type {
  CreateFinanceAccountInput,
  CreateFinanceTransactionInput,
  FinanceAccountRecord,
  FinanceTransactionRecord,
} from '@somwave/shared';
import { apiDownload, apiFetch } from '../../lib/apiClient';

export type FinanceDashboard = {
  from: string;
  to: string;
  basis: string;
  currencies: {
    currency: string;
    revenue: string;
    expenses: string;
    netProfit: string;
    debits: string;
    credits: string;
    balanced: boolean;
  }[];
};
export type TrialBalanceRow = {
  code: string;
  name: string;
  type: string;
  currency: string;
  debit: string;
  credit: string;
  balance: string;
};
export type ProjectProfitabilityRow = {
  projectId: string;
  projectName: string;
  currency: string;
  revenue: string;
  directCosts: string;
  operatingExpenses: string;
  grossProfit: string;
  netProfit: string;
  marginPercent: string | null;
};
export type FinanceJournalRecord = {
  id: string;
  reference: string;
  occurredOn: string;
  currency: string;
  memo: string;
  sourceType: string | null;
  sourceId: string | null;
  reversesJournalId: string | null;
  reversedById: string | null;
  lines: { id: string; accountCode: string; accountName: string; debit: string; credit: string }[];
};

export const financeApi = {
  dashboard: (from: string, to: string) =>
    apiFetch<FinanceDashboard>(`/finance/dashboard?from=${from}&to=${to}`),
  trialBalance: (from: string, to: string) =>
    apiFetch<TrialBalanceRow[]>(`/finance/trial-balance?from=${from}&to=${to}`),
  projectProfitability: (from: string, to: string) =>
    apiFetch<ProjectProfitabilityRow[]>(`/finance/project-profitability?from=${from}&to=${to}`),
  downloadTrialBalance: (from: string, to: string) =>
    apiDownload(
      `/finance/trial-balance.csv?from=${from}&to=${to}`,
      `somwave-trial-balance-${from}-to-${to}.csv`,
    ),
  accounts: () => apiFetch<FinanceAccountRecord[]>('/finance/accounts'),
  linkOptions: () =>
    apiFetch<{
      projects: { id: string; name: string; clientId: string | null }[];
      clients: { id: string; companyName: string }[];
    }>('/finance/link-options'),
  createAccount: (data: CreateFinanceAccountInput) =>
    apiFetch<FinanceAccountRecord>('/finance/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  transactions: () => apiFetch<FinanceTransactionRecord[]>('/finance/transactions'),
  createTransaction: (data: CreateFinanceTransactionInput) =>
    apiFetch<FinanceTransactionRecord>('/finance/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  action: (id: string, action: 'submit' | 'approve' | 'reject' | 'post', reason?: string) =>
    apiFetch<FinanceTransactionRecord>(
      `/finance/transactions/${encodeURIComponent(id)}/${action}`,
      { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) },
    ),
  journals: () => apiFetch<FinanceJournalRecord[]>('/finance/journals'),
  reverse: (id: string, reason: string) =>
    apiFetch<{ id: string; reference: string }>(
      `/finance/journals/${encodeURIComponent(id)}/reverse`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),
  closePeriod: (year: number, month: number) =>
    apiFetch<{ year: number; month: number; status: string }>('/finance/periods/close', {
      method: 'POST',
      body: JSON.stringify({ year, month }),
    }),
};
