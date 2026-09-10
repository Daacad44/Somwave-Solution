import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    employee: { findUnique: vi.fn(), create: vi.fn() },
    timesheet: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    project: { findFirst: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { listTimesheets, createTimesheet, updateTimesheetStatus } from './timesheet.service';

const employee = { id: 'emp_1', deletedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listTimesheets', () => {
  it('auto-creates an employee when the user has none', async () => {
    vi.mocked(prisma.employee.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.employee.create).mockResolvedValue(employee as never);
    vi.mocked(prisma.timesheet.findMany).mockResolvedValue([] as never);

    await listTimesheets('user_abcdefgh');

    expect(prisma.employee.create).toHaveBeenCalledOnce();
    expect(prisma.timesheet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: 'emp_1', deletedAt: null } }),
    );
  });
});

describe('createTimesheet', () => {
  it('rejects an unknown project id', async () => {
    vi.mocked(prisma.employee.findUnique).mockResolvedValue(employee as never);
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);

    await expect(
      createTimesheet('user_1', {
        date: '2026-09-01',
        hours: '8',
        isBillable: true,
        projectId: 'ghost',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.timesheet.create).not.toHaveBeenCalled();
  });
});

describe('updateTimesheetStatus', () => {
  it('throws NOT_FOUND when the timesheet is missing', async () => {
    vi.mocked(prisma.timesheet.findFirst).mockResolvedValue(null as never);
    await expect(updateTimesheetStatus('missing', 'APPROVED')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
