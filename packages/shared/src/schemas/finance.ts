import { z } from 'zod';

export const financeCurrencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Use a three-letter currency code');
export const financeAmountSchema = z
  .string()
  .regex(
    /^(?!0+(?:\.0{1,2})?$)\d{1,18}(?:\.\d{1,2})?$/,
    'Enter a positive amount with at most two decimals',
  );
export const financeAccountTypeSchema = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'DIRECT_COST',
  'EXPENSE',
]);

export const createFinanceAccountSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9.-]{1,19}$/),
  name: z.string().trim().min(2).max(120),
  type: financeAccountTypeSchema,
  currency: financeCurrencySchema.nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  allowPosting: z.boolean().default(true),
});
export type CreateFinanceAccountInput = z.infer<typeof createFinanceAccountSchema>;

export const createFinanceTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: financeAmountSchema,
  currency: financeCurrencySchema,
  category: z.string().trim().min(2).max(100),
  description: z.string().trim().min(3).max(2000),
  occurredOn: z.string().datetime({ offset: true }),
  cashAccountId: z.string().min(1),
  offsetAccountId: z.string().min(1),
  paymentMethod: z.string().trim().max(80).nullable().optional(),
  externalRef: z.string().trim().min(1).max(120).nullable().optional(),
  counterparty: z.string().trim().max(200).nullable().optional(),
  projectId: z.string().min(1).nullable().optional(),
  clientId: z.string().min(1).nullable().optional(),
});
export type CreateFinanceTransactionInput = z.infer<typeof createFinanceTransactionSchema>;
export const updateFinanceTransactionSchema = createFinanceTransactionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'At least one change is required');
export type UpdateFinanceTransactionInput = z.infer<typeof updateFinanceTransactionSchema>;

export const financeReviewSchema = z.object({
  reason: z.string().trim().min(3).max(1000).optional(),
});
export const closeFinancePeriodSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
});

export type FinanceAccountRecord = {
  id: string;
  code: string;
  name: string;
  type: z.infer<typeof financeAccountTypeSchema>;
  currency: string | null;
  isActive: boolean;
  allowPosting: boolean;
  parentId: string | null;
};

export type FinanceTransactionRecord = CreateFinanceTransactionInput & {
  id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'CANCELLED';
  createdById: string;
  reviewedById: string | null;
  reviewReason: string | null;
  postedJournalId: string | null;
  createdAt: string;
};

// Somalia has a fixed UTC+03:00 offset and no daylight-saving transitions.
export function financeBusinessDate(now = new Date()): string {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** A date input denotes midnight in Africa/Mogadishu, never browser-local midnight. */
export function parseFinanceBusinessDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const utc = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== value) return null;
  return new Date(utc.getTime() - 3 * 60 * 60 * 1000);
}
