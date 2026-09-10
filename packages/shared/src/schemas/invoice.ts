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

const moneyString = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Fadlan geli qiime sax ah');

export const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, 'Sharaxaadda waa waajib').max(500),
  quantity: moneyString,
  unitPrice: moneyString,
});

export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;

export const adminInvoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: invoiceStatusSchema,
  issueDate: z.string(),
  dueDate: z.string(),
  total: z.string(),
  paidAmount: z.string(),
  client: z.object({ id: z.string(), companyName: z.string() }),
  project: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
});

export type AdminInvoice = z.infer<typeof adminInvoiceSchema>;

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Macmiilka waa waajib'),
  projectId: z.string().optional(),
  issueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Taariikh aan sax ahayn'),
  dueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Taariikh aan sax ahayn'),
  items: z.array(invoiceItemInputSchema).min(1, 'Ugu yaraan hal sadar'),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
