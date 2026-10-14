import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findMany: vi.fn(), findFirst: vi.fn() },
    milestone: { findMany: vi.fn() },
    projectDocumentation: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock('./project.service', () => ({
  getProjectWorkspace: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { getProjectWorkspace } from './project.service';
import {
  getPortalProject,
  listPortalDocuments,
  listPortalMilestones,
  listPortalProjects,
  getPortalDocumentFile,
} from './portal.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listPortalProjects', () => {
  it('returns 404 when the user has no clientId', async () => {
    await expect(listPortalProjects(null)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it('lists only the authenticated client’s projects', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([] as never);
    await listPortalProjects('cl_1');
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: 'cl_1', deletedAt: null } }),
    );
  });
});

describe('listPortalMilestones', () => {
  it('returns 404 when the user has no clientId', async () => {
    await expect(listPortalMilestones(null)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.milestone.findMany).not.toHaveBeenCalled();
  });

  it('lists only milestones on the authenticated client’s projects', async () => {
    vi.mocked(prisma.milestone.findMany).mockResolvedValue([] as never);
    await listPortalMilestones('cl_1');
    expect(prisma.milestone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          clientVisible: true,
          project: { clientId: 'cl_1', deletedAt: null },
        },
      }),
    );
  });
});

describe('getPortalProject', () => {
  it('returns 404 when the user has no clientId', async () => {
    await expect(getPortalProject(null, 'prj_1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 for a project that belongs to another client', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    await expect(getPortalProject('cl_1', 'prj_other')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(getProjectWorkspace).not.toHaveBeenCalled();
  });
});

describe('shared client documents', () => {
  it('requires project ownership and explicit approval and visibility', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'prj_1' } as never);
    vi.mocked(prisma.projectDocumentation.findMany).mockResolvedValue([]);
    await listPortalDocuments('cl_1', 'prj_1');
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prj_1', clientId: 'cl_1', deletedAt: null },
      }),
    );
    expect(prisma.projectDocumentation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'prj_1', status: 'APPROVED', clientVisible: true, deletedAt: null },
      }),
    );
  });

  it('does not read storage when document is not approved and shared by this client', async () => {
    vi.mocked(prisma.projectDocumentation.findFirst).mockResolvedValue(null);
    await expect(getPortalDocumentFile('cl_1', 'prj_1', 'doc_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(prisma.projectDocumentation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'doc_1',
          projectId: 'prj_1',
          status: 'APPROVED',
          clientVisible: true,
          project: { clientId: 'cl_1', deletedAt: null },
        }),
      }),
    );
  });
});
