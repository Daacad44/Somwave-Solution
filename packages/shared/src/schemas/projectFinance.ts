import { z } from 'zod';

const amount = z
  .string()
  .regex(/^(?!0+(?:\.0{1,2})?$)\d{1,10}(?:\.\d{1,2})?$/, 'Enter a positive amount');

export const createProjectExpenseSchema = z.object({
  kind: z.enum(['PLANNED', 'ACTUAL']),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(2000),
  amount,
  expenseDate: z.string().datetime({ offset: true }).nullable().optional(),
});
export type CreateProjectExpenseInput = z.infer<typeof createProjectExpenseSchema>;

export const reviseProjectBudgetSchema = z.object({
  budget: amount,
  reason: z.string().trim().min(3).max(2000),
});
export type ReviseProjectBudgetInput = z.infer<typeof reviseProjectBudgetSchema>;

export const projectFinanceSchema = z.object({
  originalBudget: z.string().nullable(),
  currentBudget: z.string().nullable(),
  plannedExpenses: z.string(),
  actualExpenses: z.string(),
  utilizationPercent: z.number().nullable(),
  categories: z.array(z.object({ category: z.string(), planned: z.string(), actual: z.string() })),
  expenses: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['PLANNED', 'ACTUAL']),
      category: z.string(),
      description: z.string(),
      amount: z.string(),
      expenseDate: z.string().nullable(),
      actorId: z.string(),
      createdAt: z.string(),
    }),
  ),
  revisions: z.array(
    z.object({
      id: z.string(),
      previousBudget: z.string().nullable(),
      newBudget: z.string(),
      reason: z.string(),
      actorId: z.string(),
      createdAt: z.string(),
    }),
  ),
});
export type ProjectFinance = z.infer<typeof projectFinanceSchema>;
