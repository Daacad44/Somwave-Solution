import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getEngineeringTeamOverview } from './engineering-team.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    engineerProfile: { findMany: vi.fn() },
    projectInvitation: { count: vi.fn() },
    projectMember: { findMany: vi.fn() },
    task: { count: vi.fn() },
    project: { count: vi.fn() },
  },
}));

const actor = (roles: string[]) => ({ id: 'actor', roles }) as Express.AuthUserContext;

describe('engineering team overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.projectInvitation.count).mockResolvedValue(2);
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([{ projectId: 'p1' }] as never);
    vi.mocked(prisma.task.count).mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    vi.mocked(prisma.project.count).mockResolvedValue(1);
  });

  it('denies organization-wide staffing totals to project engineers', async () => {
    await expect(getEngineeringTeamOverview(actor(['ENGINEER']))).rejects.toMatchObject({
      status: 403,
    });
    expect(prisma.engineerProfile.findMany).not.toHaveBeenCalled();
  });

  it('counts only active identities as available and reports workload risk', async () => {
    vi.mocked(prisma.engineerProfile.findMany).mockResolvedValue([
      {
        status: 'ACTIVE',
        availability: 'AVAILABLE',
        weeklyCapacityHours: 40,
        user: { isActive: true, assignedTasks: [], availabilitySlots: [], projectMemberships: [] },
      },
      {
        status: 'ACTIVE',
        availability: 'AVAILABLE',
        weeklyCapacityHours: 40,
        user: {
          isActive: true,
          assignedTasks: [{ startDate: null, dueDate: null, estimatedHours: 45 }],
          availabilitySlots: [],
          projectMemberships: [],
        },
      },
      {
        status: 'PENDING_VERIFICATION',
        availability: 'AVAILABLE',
        weeklyCapacityHours: 40,
        user: { isActive: false, assignedTasks: [], availabilitySlots: [], projectMemberships: [] },
      },
    ] as never);

    const overview = await getEngineeringTeamOverview(actor(['ADMIN']));
    expect(overview).toMatchObject({
      totalEngineers: 3,
      activeEngineers: 2,
      pendingInvitations: 1,
      pendingProjectAcceptances: 2,
      availableEngineers: 1,
      engineersAtCapacity: 1,
      totalAssignedProjects: 1,
      activeEngineeringTasks: 4,
      overdueTasks: 1,
      projectsAtRisk: 1,
    });
  });
});
