import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

type Actor = Pick<Express.AuthUserContext, 'id' | 'roles'>;

/** One scoped read for the engineer detail page, across every accepted project. */
export async function getEngineerOperationalOverview(userId: string, actor: Actor) {
  const engineer = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, engineerProfile: { isNot: null } },
    select: { id: true },
  });
  if (!engineer) throw new AppError('NOT_FOUND', 404, 'Engineer not found');

  const admin = actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('ADMIN');
  const memberships = await prisma.projectMember.findMany({
    where: {
      userId,
      removedAt: null,
      project: {
        deletedAt: null,
        ...(!admin
          ? {
              OR: [
                { managerId: actor.id },
                {
                  members: {
                    some: { userId: actor.id, role: 'MANAGER' as const, removedAt: null },
                  },
                },
              ],
            }
          : {}),
      },
    },
    select: { projectId: true },
  });
  const projectIds = memberships.map((member) => member.projectId);
  if (!projectIds.length) {
    if (!admin) throw new AppError('NOT_FOUND', 404, 'Engineer not found');
    return emptyOverview();
  }

  const scope = { projectId: { in: projectIds } };
  const [tasks, reports, timeEntries, maintenance] = await Promise.all([
    prisma.task.findMany({
      where: { ...scope, assigneeId: userId, deletedAt: null },
      select: {
        id: true,
        title: true,
        projectId: true,
        status: true,
        dueDate: true,
        estimatedHours: true,
        progressPercent: true,
        project: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.engineerProgressReport.findMany({
      where: { ...scope, authorId: userId },
      select: {
        id: true,
        projectId: true,
        period: true,
        periodStart: true,
        status: true,
        blockers: true,
        completedWork: true,
        project: { select: { name: true } },
      },
      orderBy: { periodStart: 'desc' },
    }),
    prisma.taskTimeEntry.findMany({
      where: { userId, task: { projectId: { in: projectIds }, deletedAt: null } },
      select: {
        id: true,
        taskId: true,
        minutes: true,
        date: true,
        task: { select: { title: true, projectId: true, project: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.maintenanceRequest.findMany({
      where: { ...scope, assigneeId: userId },
      select: {
        id: true,
        projectId: true,
        title: true,
        status: true,
        scheduledAt: true,
        project: { select: { name: true } },
        system: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const now = Date.now();
  const active = tasks.filter((task) => !['DONE', 'CANCELLED'].includes(task.status));
  return {
    tasks: tasks.map(({ project, estimatedHours, ...task }) => ({
      ...task,
      projectName: project.name,
      estimatedHours: Number(estimatedHours ?? 0),
    })),
    reports: reports.map(({ project, ...report }) => ({ ...report, projectName: project.name })),
    timeEntries: timeEntries.map(({ task, ...entry }) => ({
      ...entry,
      taskTitle: task.title,
      projectId: task.projectId,
      projectName: task.project.name,
    })),
    maintenance: maintenance.map(({ project, system, ...item }) => ({
      ...item,
      projectName: project.name,
      systemName: system.name,
    })),
    summary: {
      activeTasks: active.length,
      completedTasks: tasks.filter((task) => task.status === 'DONE').length,
      overdueTasks: active.filter((task) => task.dueDate && task.dueDate.getTime() < now).length,
      openEstimateHours: active.reduce((sum, task) => sum + Number(task.estimatedHours ?? 0), 0),
      trackedMinutes: timeEntries.reduce((sum, entry) => sum + entry.minutes, 0),
      blockerReports: reports.filter((report) => Boolean(report.blockers?.trim())).length,
    },
  };
}

function emptyOverview() {
  return {
    tasks: [],
    reports: [],
    timeEntries: [],
    maintenance: [],
    summary: {
      activeTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      openEstimateHours: 0,
      trackedMinutes: 0,
      blockerReports: 0,
    },
  };
}
