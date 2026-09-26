import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findMany: vi.fn(), findFirst: vi.fn() },
    milestone: { findMany: vi.fn() },
  },
}));
vi.mock('./project.service', () => ({
  getProjectWorkspace: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { getProjectWorkspace } from './project.service';
import { getPortalProject, listPortalMilestones, listPortalProjects } from './portal.service';

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
        where: { deletedAt: null, project: { clientId: 'cl_1', deletedAt: null } },
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
