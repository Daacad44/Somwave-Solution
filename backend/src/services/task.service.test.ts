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
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import { prisma } from '../lib/prisma';
import { createTask, updateTask, deleteTask, listTasks } from './task.service';

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
  it('creates a task after validating the project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.task.create).mockResolvedValue(row as never);

    const result = await createTask(input);

    expect(result).toMatchObject({ id: 'tsk_1', project: { id: 'prj_1', name: 'Website' } });
    expect(prisma.task.create).toHaveBeenCalledOnce();
  });

  it('rejects an unknown project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);

    await expect(createTask(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown assignee', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

    await expect(createTask({ ...input, assigneeId: 'ghost' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});

describe('updateTask', () => {
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

    await deleteTask('tsk_1');

    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'tsk_1' },
      data: { deletedAt: expect.any(Date) },
    });
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
