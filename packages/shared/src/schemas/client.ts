import { z } from 'zod';

export const CLIENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const clientStatusSchema = z.enum(CLIENT_STATUSES);
export type ClientStatus = z.infer<typeof clientStatusSchema>;

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'Firfircoon',
  INACTIVE: 'Joogsan',
};

export const adminClientSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  status: clientStatusSchema,
  createdAt: z.string(),
});

export type AdminClient = z.infer<typeof adminClientSchema>;

export const createClientSchema = z.object({
  companyName: z.string().trim().min(1, 'Magaca shirkadda waa waajib').max(200),
  email: z.string().trim().email('Fadlan geli iimayl sax ah').optional(),
  phone: z.string().trim().max(40).optional(),
  status: clientStatusSchema.default('ACTIVE'),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z
  .object({
    companyName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email().nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    status: clientStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdateClientInput = z.infer<typeof updateClientSchema>;
