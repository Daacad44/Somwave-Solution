import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { calculateWeeklyCapacity } from './engineering-capacity.service';

const ACTIVE_TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'TESTING'] as const;

/** Organization-wide staffing totals are limited to administrators. */
export async function getEngineeringTeamOverview(actor: Express.AuthUserContext) {
  if (!actor.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN')) {
    throw new AppError('FORBIDDEN', 403, 'Administrator access required');
  }

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
  const profiles = await prisma.engineerProfile.findMany({
    where: { user: { deletedAt: null } },
    select: {
      status: true,
      availability: true,
      weeklyCapacityHours: true,
      user: {
        select: {
          isActive: true,
          assignedTasks: {
            where: {
              deletedAt: null,
              approvalStatus: 'APPROVED',
              status: { in: [...ACTIVE_TASK_STATUSES] },
              project: { deletedAt: null, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
            },
            select: { startDate: true, dueDate: true, estimatedHours: true },
          },
          availabilitySlots: {
            where: { endAt: { gt: now }, startAt: { lt: weekAhead } },
            select: { startAt: true, endAt: true, kind: true },
          },
          projectMemberships: {
            where: {
              removedAt: null,
              project: { deletedAt: null, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
            },
            select: { startDate: true, expectedEndDate: true, estimatedHours: true },
          },
        },
      },
    },
  });
  let availableEngineers = 0;
  let engineersAtCapacity = 0;
  for (const profile of profiles) {
    if (profile.status !== 'ACTIVE' || !profile.user.isActive) continue;
    const currentWeek = calculateWeeklyCapacity(
      profile.user.assignedTasks.map((task) => ({
        startDate: task.startDate,
        dueDate: task.dueDate,
        estimatedHours: Number(task.estimatedHours ?? 0),
      })),
      profile.user.availabilitySlots,
      Number(profile.weeklyCapacityHours),
      profile.availability,
      now,
    )[0]!;
    const projectCommitment = profile.user.projectMemberships.reduce((total, member) => {
      if (!member.estimatedHours) return total;
      const end = member.expectedEndDate?.getTime() ?? now.getTime() + 28 * 86_400_000;
      const start = member.startDate?.getTime() ?? now.getTime();
      if (end < now.getTime() || start > weekAhead.getTime()) return total;
      const weeks = Math.max(1, Math.ceil((end - start) / (7 * 86_400_000)));
      return total + Number(member.estimatedHours) / weeks;
    }, 0);
    const committedHours = Math.max(currentWeek.estimatedHours, projectCommitment);
    if (currentWeek.availableHours <= 0 || committedHours >= currentWeek.availableHours) {
      engineersAtCapacity++;
    } else if (profile.availability === 'AVAILABLE') {
      availableEngineers++;
    }
  }

  const activeProject: Prisma.ProjectWhereInput = {
    deletedAt: null,
    status: { notIn: ['CANCELLED', 'COMPLETED'] },
  };
  const [
    pendingProjectAcceptances,
    assignedProjectRows,
    activeEngineeringTasks,
    overdueTasks,
    projectsAtRisk,
  ] = await Promise.all([
    prisma.projectInvitation.count({
      where: {
        status: 'PENDING',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        project: activeProject,
      },
    }),
    prisma.projectMember.findMany({
      where: { removedAt: null, project: activeProject },
      distinct: ['projectId'],
      select: { projectId: true },
    }),
    prisma.task.count({
      where: {
        deletedAt: null,
        approvalStatus: 'APPROVED',
        status: { in: [...ACTIVE_TASK_STATUSES] },
        project: activeProject,
      },
    }),
    prisma.task.count({
      where: {
        deletedAt: null,
        dueDate: { lt: now },
        status: { in: [...ACTIVE_TASK_STATUSES] },
        project: activeProject,
      },
    }),
    prisma.project.count({
      where: {
        ...activeProject,
        OR: [
          { dueDate: { lt: weekAhead } },
          { tasks: { some: { deletedAt: null, status: 'BLOCKED' } } },
          {
            tasks: {
              some: {
                deletedAt: null,
                dueDate: { lt: now },
                status: { in: [...ACTIVE_TASK_STATUSES] },
              },
            },
          },
        ],
      },
    }),
  ]);

  return {
    totalEngineers: profiles.length,
    activeEngineers: profiles.filter(
      (profile) => profile.status === 'ACTIVE' && profile.user.isActive,
    ).length,
    pendingInvitations: profiles.filter((profile) =>
      ['INVITED', 'PENDING_VERIFICATION', 'PENDING_ACTIVATION'].includes(profile.status),
    ).length,
    pendingProjectAcceptances,
    availableEngineers,
    engineersAtCapacity,
    totalAssignedProjects: assignedProjectRows.length,
    activeEngineeringTasks,
    overdueTasks,
    projectsAtRisk,
  };
}
