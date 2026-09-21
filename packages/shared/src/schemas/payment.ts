import { z } from 'zod';

export const PAYMENT_METHODS = ['BANK_TRANSFER', 'EVC_PLUS', 'EDAHAB', 'STRIPE', 'MANUAL'] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Wareejin bangiga',
  EVC_PLUS: 'EVC Plus',
  EDAHAB: 'eDahab',
  STRIPE: 'Stripe',
  MANUAL: 'Gacanta',
};

export const PAYMENT_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const;
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

const moneyString = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Fadlan geli qiime sax ah');

export const paymentRecordSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  amount: z.string(),
  method: paymentMethodSchema,
  status: paymentStatusSchema,
  reference: z.string().nullable(),
  createdAt: z.string(),
});

export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Biilka waa waajib'),
  amount: moneyString,
  method: paymentMethodSchema.default('BANK_TRANSFER'),
  reference: z.string().trim().max(120).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
