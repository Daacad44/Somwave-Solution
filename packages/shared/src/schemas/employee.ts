import { z } from 'zod';

export const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as const;
export const employeeStatusSchema = z.enum(EMPLOYEE_STATUSES);
export type EmployeeStatus = z.infer<typeof employeeStatusSchema>;

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'Shaqeeya',
  ON_LEAVE: 'Fasax',
  TERMINATED: 'Joogsaday',
};

export const adminEmployeeSchema = z.object({
  id: z.string(),
  employeeNo: z.string(),
  position: z.string().nullable(),
  department: z.string().nullable(),
  status: employeeStatusSchema,
  hiredAt: z.string().nullable(),
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
});

export type AdminEmployee = z.infer<typeof adminEmployeeSchema>;

export const createEmployeeSchema = z.object({
  userId: z.string().min(1, 'Isticmaalaha waa waajib'),
  employeeNo: z.string().trim().min(1, 'Lambarka shaqaalaha waa waajib').max(40),
  position: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  hiredAt: z.string().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
  .object({
    position: z.string().trim().max(120).nullable().optional(),
    department: z.string().trim().max(120).nullable().optional(),
    status: employeeStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Ugu yaraan hal beddel ayaa loo baahan yahay',
  });

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
