import { beforeEach, describe, expect, it, vi } from 'vitest';
import { documentPlanSchema } from '@somwave/shared';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    projectDocumentation: { findFirst: vi.fn() },
    documentPlanProposal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    projectPhase: { create: vi.fn() },
    milestone: { create: vi.fn() },
    task: { create: vi.fn() },
    taskDependency: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma';
import {
  createDocumentPlan,
  reviewDocumentPlan,
  suggestDocumentPlan,
} from './document-plan.service';

const actor = {
  id: 'manager-a',
  email: 'manager@example.test',
  name: 'Manager',
  roles: ['STAFF'],
  permissions: [],
  clientId: null,
  twoFactorEnabled: false,
  twoFactorRequired: false,
};

const plan = documentPlanSchema.parse({
  phases: [{ key: 'phase1', title: 'Build' }],
  milestones: [{ key: 'milestone1', phaseKey: 'phase1', title: 'Release' }],
  tasks: [
    { key: 'epic1', kind: 'EPIC', title: 'API', phaseKey: 'phase1', milestoneKey: 'milestone1' },
    {
      key: 'task1',
      kind: 'TASK',
      title: 'Endpoint',
      phaseKey: 'phase1',
      milestoneKey: 'milestone1',
      parentKey: 'epic1',
      checklist: ['Document response'],
    },
    {
      key: 'sub1',
      kind: 'SUBTASK',
      title: 'Validate input',
      phaseKey: 'phase1',
      milestoneKey: 'milestone1',
      parentKey: 'task1',
      dependencyKeys: ['epic1'],
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.project.findFirst).mockResolvedValue({
    id: 'project-a',
    managerId: actor.id,
  } as never);
  vi.mocked(prisma.projectDocumentation.findFirst).mockResolvedValue({
    id: 'doc-a',
    projectId: 'project-a',
    title: 'Requirements',
    status: 'APPROVED',
    format: 'MARKDOWN',
    content: '# Build\n## Release\n### API\n- Endpoint\n  - Validate input',
    currentVersion: 3,
  } as never);
  vi.mocked(prisma.documentPlanProposal.findFirst).mockResolvedValue({
    id: 'plan-a',
    documentId: 'doc-a',
    sourceVersion: 3,
    status: 'PROPOSED',
    plan,
    proposedById: 'engineer-a',
  } as never);
  vi.mocked(prisma.documentPlanProposal.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.$transaction).mockImplementation((async (callback: unknown) =>
    (callback as (tx: typeof prisma) => Promise<unknown>)(prisma)) as never);
  vi.mocked(prisma.projectPhase.create).mockResolvedValue({ id: 'phase-db' } as never);
  vi.mocked(prisma.milestone.create).mockResolvedValue({ id: 'milestone-db' } as never);
  vi.mocked(prisma.task.create)
    .mockResolvedValueOnce({ id: 'epic-db' } as never)
    .mockResolvedValueOnce({ id: 'task-db' } as never)
    .mockResolvedValueOnce({ id: 'sub-db' } as never);
});

describe('document planning', () => {
  it('suggests a full phase/milestone/epic/task/subtask hierarchy from headings and bullets', () => {
    const suggested = suggestDocumentPlan(
      '# Build\n## Release\n### API\n- Endpoint\n  - Validate input',
      'MARKDOWN',
    );
    expect(suggested.tasks.map((item) => item.kind)).toEqual(['EPIC', 'TASK', 'SUBTASK']);
    expect(suggested.tasks[2]?.parentKey).toBe(suggested.tasks[1]?.key);
  });

  it('rejects inconsistent milestone links and cyclic dependencies', () => {
    expect(
      documentPlanSchema.safeParse({
        ...plan,
        tasks: [{ ...plan.tasks[0], milestoneKey: 'wrong' }],
      }).success,
    ).toBe(false);
    expect(
      documentPlanSchema.safeParse({
        ...plan,
        tasks: [
          { ...plan.tasks[0], dependencyKeys: ['task1'] },
          { ...plan.tasks[1], dependencyKeys: ['epic1'] },
          plan.tasks[2],
        ],
      }).success,
    ).toBe(false);
  });

  it('does not create a proposal from unapproved documentation', async () => {
    vi.mocked(prisma.projectDocumentation.findFirst).mockResolvedValue({
      status: 'DRAFT',
    } as never);
    await expect(createDocumentPlan('project-a', 'doc-a', actor, { plan })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prisma.documentPlanProposal.create).not.toHaveBeenCalled();
  });

  it('requires manager approval before activating a proposal', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'project-a',
      managerId: null,
    } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      role: 'ENGINEER',
      removedAt: null,
    } as never);
    await expect(
      reviewDocumentPlan('project-a', 'doc-a', 'plan-a', actor, 'activate'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires the source version to remain approved and unchanged', async () => {
    vi.mocked(prisma.projectDocumentation.findFirst).mockResolvedValue({
      status: 'APPROVED',
      currentVersion: 4,
    } as never);
    await expect(
      reviewDocumentPlan('project-a', 'doc-a', 'plan-a', actor, 'activate'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.projectPhase.create).not.toHaveBeenCalled();
  });

  it('atomically claims approval and materializes linked planning records', async () => {
    const result = await reviewDocumentPlan('project-a', 'doc-a', 'plan-a', actor, 'activate');
    expect(result).toMatchObject({
      status: 'ACTIVATED',
      phaseIds: { phase1: 'phase-db' },
      milestoneIds: { milestone1: 'milestone-db' },
    });
    expect(prisma.documentPlanProposal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan-a', documentId: 'doc-a', status: 'PROPOSED' } }),
    );
    expect(prisma.task.create).toHaveBeenCalledTimes(3);
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Validate input',
          parentTaskId: 'task-db',
          approvalStatus: 'APPROVED',
        }),
      }),
    );
    expect(prisma.taskDependency.createMany).toHaveBeenCalledWith({
      data: [{ taskId: 'sub-db', dependsOnId: 'epic-db' }],
    });
  });

  it('does not duplicate tasks when another reviewer already claimed the proposal', async () => {
    vi.mocked(prisma.documentPlanProposal.updateMany).mockResolvedValue({ count: 0 } as never);
    await expect(
      reviewDocumentPlan('project-a', 'doc-a', 'plan-a', actor, 'activate'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});
