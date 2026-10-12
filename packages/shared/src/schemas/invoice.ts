import { z } from 'zod';

export const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'] as const;
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Qabyo',
  SENT: 'La diray',
  PARTIAL: 'Qayb ahaan',
  PAID: 'La bixiyay',
  OVERDUE: 'Dhacay',
  VOID: 'La buriyay',
};

const moneyString = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter a valid amount');

export const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  quantity: moneyString,
  unitPrice: moneyString,
});

export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;

export const invoiceItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.string(),
  unitPrice: z.string(),
  lineTotal: z.string(),
});

export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

export const adminInvoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: invoiceStatusSchema,
  issueDate: z.string(),
  dueDate: z.string(),
  subtotal: z.string(),
  tax: z.string(),
  discount: z.string(),
  total: z.string(),
  paidAmount: z.string(),
  client: z.object({ id: z.string(), companyName: z.string() }),
  project: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
});

export type AdminInvoice = z.infer<typeof adminInvoiceSchema>;

export const invoiceDetailSchema = adminInvoiceSchema.extend({
  items: z.array(invoiceItemSchema),
});

export type InvoiceDetail = z.infer<typeof invoiceDetailSchema>;

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  projectId: z.string().optional(),
  issueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  dueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  tax: moneyString.default('0'),
  discount: moneyString.default('0'),
  items: z.array(invoiceItemInputSchema).min(1, 'At least one line item is required'),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
