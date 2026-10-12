import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    projectDocumentation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    documentationVersion: { findMany: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock('../lib/storage', () => ({ putObject: vi.fn(), readObject: vi.fn() }));

import { prisma } from '../lib/prisma';
import { putObject } from '../lib/storage';
import {
  createProjectDocumentation,
  getProjectDocumentation,
  listProjectDocumentation,
} from './project-documentation.service';

const engineer = {
  id: 'user-a',
  email: 'a@example.test',
  name: 'A',
  roles: ['STAFF'],
  permissions: [],
  clientId: null,
  twoFactorEnabled: false,
  twoFactorRequired: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.project.findFirst).mockResolvedValue({
    id: 'project-a',
    managerId: null,
  } as never);
  vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
    role: 'ENGINEER',
    removedAt: null,
  } as never);
});

describe('project documentation isolation', () => {
  it('hides documents from users outside the project', async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null as never);
    await expect(listProjectDocumentation('project-a', engineer, {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(prisma.projectDocumentation.findMany).not.toHaveBeenCalled();
  });

  it('rejects removed members before reading a document', async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      role: 'ENGINEER',
      removedAt: new Date(),
    } as never);
    await expect(getProjectDocumentation('project-a', 'doc-a', engineer)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(prisma.projectDocumentation.findFirst).not.toHaveBeenCalled();
  });

  it('scopes the document lookup to the requested project', async () => {
    vi.mocked(prisma.projectDocumentation.findFirst).mockResolvedValue(null as never);
    await expect(getProjectDocumentation('project-a', 'doc-a', engineer)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(prisma.projectDocumentation.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc-a', projectId: 'project-a', deletedAt: null },
    });
  });
});

describe('file validation', () => {
  it('rejects a file whose bytes do not match the claimed MIME type', async () => {
    await expect(
      createProjectDocumentation('project-a', engineer, {
        title: 'Requirements',
        format: 'FILE',
        fileName: 'requirements.pdf',
        mimeType: 'application/pdf',
        contentBase64: Buffer.from('hello').toString('base64'),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(putObject).not.toHaveBeenCalled();
    expect(prisma.projectDocumentation.create).not.toHaveBeenCalled();
  });

  it('allows Markdown bytes but stores them outside the database', async () => {
    vi.mocked(putObject).mockResolvedValue('obj/123' as never);
    vi.mocked(prisma.projectDocumentation.create).mockResolvedValue({
      id: 'doc-a',
      projectId: 'project-a',
      title: 'Notes',
      category: null,
      folder: null,
      format: 'FILE',
      content: null,
      fileName: 'notes.md',
      mimeType: 'text/markdown',
      sizeBytes: 7,
      status: 'DRAFT',
      currentVersion: 1,
      ownerId: null,
      createdById: 'user-a',
      updatedById: null,
      approvedById: null,
      approvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    await createProjectDocumentation('project-a', engineer, {
      title: 'Notes',
      format: 'FILE',
      fileName: 'notes.md',
      mimeType: 'text/markdown',
      contentBase64: Buffer.from('# Notes').toString('base64'),
    });
    expect(prisma.projectDocumentation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: null, storageKey: 'obj/123' }),
      }),
    );
  });
});
