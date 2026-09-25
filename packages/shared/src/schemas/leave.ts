import { z } from 'zod';

export const LEAVE_TYPES = ['ANNUAL', 'SICK', 'UNPAID', 'OTHER'] as const;
export const leaveTypeSchema = z.enum(LEAVE_TYPES);
export type LeaveType = z.infer<typeof leaveTypeSchema>;

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL: 'Sanadle',
  SICK: 'Jirro',
  UNPAID: 'Aan la bixin',
  OTHER: 'Kale',
};

export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const leaveStatusSchema = z.enum(LEAVE_STATUSES);
export type LeaveStatus = z.infer<typeof leaveStatusSchema>;

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: 'Sugaya',
  APPROVED: 'La oggolaaday',
  REJECTED: 'La diiday',
};

export const adminLeaveRequestSchema = z.object({
  id: z.string(),
  type: leaveTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().nullable(),
  status: leaveStatusSchema,
  rejectionReason: z.string().nullable(),
  employee: z.object({
    id: z.string(),
    employeeNo: z.string(),
    user: z.object({ name: z.string() }),
  }),
});

export type AdminLeaveRequest = z.infer<typeof adminLeaveRequestSchema>;

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().min(1, 'Shaqaalaha waa waajib'),
  type: leaveTypeSchema,
  startDate: z.string().min(1, 'Bilowga waa waajib'),
  endDate: z.string().min(1, 'Dhammaadka waa waajib'),
  reason: z.string().trim().max(2000).optional(),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

export const updateLeaveRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().trim().max(2000).optional(),
});

export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;
