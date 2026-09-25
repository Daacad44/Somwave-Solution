import type {
  AdminAttendance,
  AdminEmployee,
  AdminLeaveRequest,
  CreateEmployeeInput,
  CreateLeaveRequestInput,
  EmployeeStatus,
  LeaveStatus,
  UpdateEmployeeInput,
  UpdateLeaveRequestInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { writeAudit } from '../lib/audit';

function toEmployee(row: {
  id: string;
  employeeNo: string;
  position: string | null;
  department: string | null;
  status: EmployeeStatus;
  hiredAt: Date | null;
  user: { id: string; name: string; email: string };
}): AdminEmployee {
  return {
    id: row.id,
    employeeNo: row.employeeNo,
    position: row.position,
    department: row.department,
    status: row.status,
    hiredAt: row.hiredAt?.toISOString() ?? null,
    user: row.user,
  };
}

export async function listEmployees(): Promise<AdminEmployee[]> {
  const rows = await prisma.employee.findMany({
    where: { deletedAt: null },
    orderBy: { employeeNo: 'asc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map(toEmployee);
}

export async function listEmployeeCandidates(): Promise<
  { id: string; name: string; email: string }[]
> {
  return prisma.user.findMany({
    where: { deletedAt: null, isActive: true, employee: { is: null } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: 100,
  });
}

export async function createEmployee(
  input: CreateEmployeeInput,
  actorId: string,
): Promise<AdminEmployee> {
  const user = await prisma.user.findFirst({ where: { id: input.userId, deletedAt: null } });
  if (!user) throw new AppError('NOT_FOUND', 404, 'Isticmaalaha lama helin');
  const existing = await prisma.employee.findFirst({
    where: { OR: [{ userId: input.userId }, { employeeNo: input.employeeNo }], deletedAt: null },
  });
  if (existing) throw new AppError('CONFLICT', 409, 'Shaqaalahan hore ayuu u jiray');
  const row = await prisma.employee.create({
    data: {
      userId: input.userId,
      employeeNo: input.employeeNo,
      position: input.position ?? null,
      department: input.department ?? null,
      hiredAt: input.hiredAt ? new Date(input.hiredAt) : null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  await prisma.user.update({ where: { id: user.id }, data: { employeeId: row.id } });
  await writeAudit({
    actorId,
    action: 'employee.create',
    subjectType: 'Employee',
    subjectId: row.id,
  });
  return toEmployee(row);
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
  actorId: string,
): Promise<AdminEmployee> {
  const existing = await prisma.employee.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Shaqaalahan lama helin');
  const row = await prisma.employee.update({
    where: { id },
    data: {
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  await writeAudit({ actorId, action: 'employee.update', subjectType: 'Employee', subjectId: id });
  return toEmployee(row);
}

function dayStart(value = new Date()): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export async function listAttendance(): Promise<AdminAttendance[]> {
  const rows = await prisma.attendance.findMany({
    orderBy: { date: 'desc' },
    take: 100,
    include: { employee: { include: { user: { select: { name: true } } } } },
  });
  return rows.map((row) => ({
    id: row.id,
    date: row.date.toISOString(),
    checkInAt: row.checkInAt?.toISOString() ?? null,
    checkOutAt: row.checkOutAt?.toISOString() ?? null,
    employee: {
      id: row.employee.id,
      employeeNo: row.employee.employeeNo,
      user: { name: row.employee.user.name },
    },
  }));
}

export async function checkIn(employeeId: string): Promise<AdminAttendance> {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } });
  if (!employee) throw new AppError('NOT_FOUND', 404, 'Shaqaalahan lama helin');
  const date = dayStart();
  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });
  if (existing?.checkInAt) throw new AppError('CONFLICT', 409, 'Maanta hore ayaad u soo gashay');
  const row = existing
    ? await prisma.attendance.update({
        where: { id: existing.id },
        data: { checkInAt: new Date() },
        include: { employee: { include: { user: { select: { name: true } } } } },
      })
    : await prisma.attendance.create({
        data: { employeeId, date, checkInAt: new Date() },
        include: { employee: { include: { user: { select: { name: true } } } } },
      });
  return {
    id: row.id,
    date: row.date.toISOString(),
    checkInAt: row.checkInAt?.toISOString() ?? null,
    checkOutAt: row.checkOutAt?.toISOString() ?? null,
    employee: {
      id: row.employee.id,
      employeeNo: row.employee.employeeNo,
      user: { name: row.employee.user.name },
    },
  };
}

export async function checkOut(employeeId: string): Promise<AdminAttendance> {
  const date = dayStart();
  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
    include: { employee: { include: { user: { select: { name: true } } } } },
  });
  if (!existing?.checkInAt) throw new AppError('NOT_FOUND', 404, 'Soo-gelitaan maanta lama helin');
  if (existing.checkOutAt) throw new AppError('CONFLICT', 409, 'Hore ayaad u baxday');
  const row = await prisma.attendance.update({
    where: { id: existing.id },
    data: { checkOutAt: new Date() },
    include: { employee: { include: { user: { select: { name: true } } } } },
  });
  return {
    id: row.id,
    date: row.date.toISOString(),
    checkInAt: row.checkInAt?.toISOString() ?? null,
    checkOutAt: row.checkOutAt?.toISOString() ?? null,
    employee: {
      id: row.employee.id,
      employeeNo: row.employee.employeeNo,
      user: { name: row.employee.user.name },
    },
  };
}

export async function listLeaveRequests(): Promise<AdminLeaveRequest[]> {
  const rows = await prisma.leaveRequest.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { employee: { include: { user: { select: { name: true } } } } },
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    reason: row.reason,
    status: row.status,
    rejectionReason: row.rejectionReason,
    employee: {
      id: row.employee.id,
      employeeNo: row.employee.employeeNo,
      user: { name: row.employee.user.name },
    },
  }));
}

export async function createLeaveRequest(
  input: CreateLeaveRequestInput,
): Promise<AdminLeaveRequest> {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null },
  });
  if (!employee) throw new AppError('NOT_FOUND', 404, 'Shaqaalahan lama helin');
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new AppError('VALIDATION_ERROR', 400, 'Taariikhaha fasaxa waa khalad');
  }
  const row = await prisma.leaveRequest.create({
    data: {
      employeeId: input.employeeId,
      type: input.type,
      startDate: start,
      endDate: end,
      reason: input.reason ?? null,
    },
    include: { employee: { include: { user: { select: { name: true } } } } },
  });
  return {
    id: row.id,
    type: row.type,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    reason: row.reason,
    status: row.status,
    rejectionReason: row.rejectionReason,
    employee: {
      id: row.employee.id,
      employeeNo: row.employee.employeeNo,
      user: { name: row.employee.user.name },
    },
  };
}

export async function updateLeaveRequest(
  id: string,
  input: UpdateLeaveRequestInput,
  actorId: string,
): Promise<AdminLeaveRequest> {
  const existing = await prisma.leaveRequest.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Codsiga fasaxa lama helin');
  if (existing.status !== 'PENDING') {
    throw new AppError('CONFLICT', 409, "Codsigan hore ayaa loo go'aamiyay");
  }
  const status: LeaveStatus = input.status;
  const row = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      rejectionReason: status === 'REJECTED' ? (input.rejectionReason ?? 'La diiday') : null,
    },
    include: { employee: { include: { user: { select: { name: true } } } } },
  });
  await writeAudit({
    actorId,
    action: `leave.${status.toLowerCase()}`,
    subjectType: 'LeaveRequest',
    subjectId: id,
  });
  return {
    id: row.id,
    type: row.type,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    reason: row.reason,
    status: row.status,
    rejectionReason: row.rejectionReason,
    employee: {
      id: row.employee.id,
      employeeNo: row.employee.employeeNo,
      user: { name: row.employee.user.name },
    },
  };
}
