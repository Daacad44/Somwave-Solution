import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    employee: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    user: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    attendance: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { checkIn, listEmployees } from './hr.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listEmployees', () => {
  it('returns mapped employee rows', async () => {
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: 'emp_1',
        employeeNo: 'E-001',
        position: 'Engineer',
        department: 'Delivery',
        status: 'ACTIVE',
        hiredAt: null,
        user: { id: 'u1', name: 'Cali', email: 'cali@example.com' },
      },
    ] as never);
    const rows = await listEmployees();
    expect(rows[0]?.employeeNo).toBe('E-001');
    expect(rows[0]?.user.name).toBe('Cali');
  });
});

describe('checkIn', () => {
  it('rejects a second check-in on the same day', async () => {
    vi.mocked(prisma.employee.findFirst).mockResolvedValue({ id: 'emp_1' } as never);
    vi.mocked(prisma.attendance.findUnique).mockResolvedValue({
      id: 'att_1',
      checkInAt: new Date(),
    } as never);
    await expect(checkIn('emp_1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
