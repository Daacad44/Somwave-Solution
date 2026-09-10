import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: { project: { findMany: vi.fn() } },
}));

import { prisma } from '../lib/prisma';
import { listPortalProjects } from './portal.service';

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
