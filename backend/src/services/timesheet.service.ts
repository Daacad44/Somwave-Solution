import { Prisma } from '@prisma/client';
import type { AdminTimesheet, CreateTimesheetInput, TimesheetStatus } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

function toAdmin(row: {
  id: string;
  date: Date;
  hours: Prisma.Decimal;
  isBillable: boolean;
  note: string | null;
  status: TimesheetStatus;
  createdAt: Date;
  project: { id: string; name: string } | null;
  employee: { id: string; user: { name: string } };
}): AdminTimesheet {
  return {
    id: row.id,
    date: row.date.toISOString(),
    hours: row.hours.toString(),
    isBillable: row.isBillable,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    project: row.project,
    employee: { id: row.employee.id, name: row.employee.user.name },
  };
}

const include = {
  project: { select: { id: true, name: true } },
  employee: { select: { id: true, user: { select: { name: true } } } },
} as const;

async function ensureEmployee(userId: string): Promise<string> {
  const existing = await prisma.employee.findUnique({ where: { userId } });
  if (existing && !existing.deletedAt) return existing.id;
  const created = await prisma.employee.create({
    data: { userId, employeeNo: `EMP-${userId.slice(-8).toUpperCase()}` },
  });
  return created.id;
}

export async function listTimesheets(userId: string): Promise<AdminTimesheet[]> {
  const employeeId = await ensureEmployee(userId);
  const rows = await prisma.timesheet.findMany({
    where: { employeeId, deletedAt: null },
    orderBy: { date: 'desc' },
    include,
  });
  return rows.map(toAdmin);
}

export async function createTimesheet(
  userId: string,
  input: CreateTimesheetInput,
): Promise<AdminTimesheet> {
  const employeeId = await ensureEmployee(userId);
  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
    });
    if (!project) throw new AppError('VALIDATION_ERROR', 400, 'Mashruucan lama helin');
  }
  const row = await prisma.timesheet.create({
    data: {
      employeeId,
      projectId: input.projectId ?? null,
      date: new Date(input.date),
      hours: new Prisma.Decimal(input.hours),
      isBillable: input.isBillable,
      note: input.note ?? null,
    },
    include,
  });
  return toAdmin(row);
}

export async function updateTimesheetStatus(
  id: string,
  status: TimesheetStatus,
): Promise<AdminTimesheet> {
  const existing = await prisma.timesheet.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Diiwaankan lama helin');
  const row = await prisma.timesheet.update({ where: { id }, data: { status }, include });
  return toAdmin(row);
}
