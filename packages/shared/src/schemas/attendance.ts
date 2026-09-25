import { z } from 'zod';

export const adminAttendanceSchema = z.object({
  id: z.string(),
  date: z.string(),
  checkInAt: z.string().nullable(),
  checkOutAt: z.string().nullable(),
  employee: z.object({
    id: z.string(),
    employeeNo: z.string(),
    user: z.object({ name: z.string() }),
  }),
});

export type AdminAttendance = z.infer<typeof adminAttendanceSchema>;

export const checkInSchema = z.object({
  employeeId: z.string().min(1, 'Shaqaalaha waa waajib'),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
