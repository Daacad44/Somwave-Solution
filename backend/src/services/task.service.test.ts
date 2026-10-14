import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    project: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import { prisma } from '../lib/prisma';
import { createTask, updateTask, deleteTask, listTasks } from './task.service';
import type { AuthUser } from '@somwave/shared';

const engineer: AuthUser = {
  id: 'engineer_1',
  name: 'Engineer',
  email: 'engineer@example.test',
  roles: ['ENGINEER'],
  permissions: [],
  clientId: null,
  twoFactorEnabled: false,
  twoFactorRequired: false,
};
const admin: AuthUser = { ...engineer, id: 'admin_1', roles: ['ADMIN'] };
const staffViewer: AuthUser = { ...engineer, id: 'staff_1', roles: ['STAFF'] };

const row = {
  id: 'tsk_1',
  title: 'Design the schema',
  description: null,
  status: 'TODO' as const,
  priority: 'MEDIUM' as const,
  dueDate: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  project: { id: 'prj_1', name: 'Website' },
  assignee: null,
};

const input = {
  projectId: 'prj_1',
  title: 'Design the schema',
  status: 'TODO' as const,
  priority: 'MEDIUM' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTask', () => {
  it('keeps engineers in the reviewed proposal workflow', async () => {
    vi.mocked(prisma.project.findFirst)
      .mockResolvedValueOnce({ id: 'prj_1' } as never)
      .mockResolvedValueOnce(null as never);
    await expect(createTask(input, engineer)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
  it('creates a task after validating the project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.task.create).mockResolvedValue(row as never);

    const result = await createTask(input, admin);

    expect(result).toMatchObject({ id: 'tsk_1', project: { id: 'prj_1', name: 'Website' } });
    expect(prisma.task.create).toHaveBeenCalledOnce();
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ approvalStatus: 'APPROVED', reviewRequired: false }),
      }),
    );
  });

  it('rejects an unknown project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);

    await expect(createTask(input, admin)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown assignee', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

    await expect(createTask({ ...input, assigneeId: 'ghost' }, admin)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('rejects a suspended task assignee', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
    await expect(createTask({ ...input, assigneeId: 'suspended' }, admin)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'suspended', isActive: true, deletedAt: null } }),
    );
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('does not let a staff viewer bypass independent task review', async () => {
    vi.mocked(prisma.project.findFirst)
      .mockResolvedValueOnce({ id: input.projectId } as never)
      .mockResolvedValueOnce(null as never);
    await expect(createTask(input, staffViewer)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});

describe('updateTask', () => {
  it('prevents engineers from changing another member’s task', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'tsk_1',
      projectId: 'prj_1',
      assigneeId: 'someone_else',
      approvalStatus: 'APPROVED',
    } as never);
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    await expect(updateTask('tsk_1', { status: 'DONE' }, engineer)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('lets an engineer update progress on an approved assigned task', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'tsk_1',
      projectId: 'prj_1',
      assigneeId: engineer.id,
      approvalStatus: 'APPROVED',
    } as never);
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.task.update).mockResolvedValue({ ...row, status: 'IN_PROGRESS' } as never);
    await expect(updateTask('tsk_1', { status: 'IN_PROGRESS' }, engineer)).resolves.toMatchObject({
      status: 'IN_PROGRESS',
    });
  });
  it('throws NOT_FOUND when the task is missing', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null as never);
    await expect(updateTask('missing', { status: 'DONE' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('updates the status of an existing task', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({ id: 'tsk_1' } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({ ...row, status: 'DONE' } as never);

    const result = await updateTask('tsk_1', { status: 'DONE' });
    expect(result.status).toBe('DONE');
  });
});

describe('deleteTask', () => {
  it('soft-deletes an existing task', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({ id: 'tsk_1' } as never);
    vi.mocked(prisma.task.update).mockResolvedValue({} as never);

    await deleteTask('tsk_1', admin);

    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'tsk_1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('does not let a global manager with viewer membership delete another project task', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null as never);
    await expect(deleteTask('tsk_1', { ...staffViewer, roles: ['MANAGER'] })).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ project: { OR: expect.any(Array) } }),
      }),
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});

describe('listTasks', () => {
  it('clamps the page size and maps rows', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([row] as never);
    vi.mocked(prisma.task.count).mockResolvedValue(1 as never);

    const result = await listTasks({ page: 1, pageSize: 500 });

    expect(result.pageSize).toBe(100);
    expect(result.items[0]?.project.name).toBe('Website');
    expect(result.total).toBe(1);
  });
});
