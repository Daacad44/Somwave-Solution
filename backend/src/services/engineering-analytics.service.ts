import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { listMyProjects, type EngineeringActor } from './engineering.service';

type CountRow = { month: Date; count: bigint };
type MaintenanceRow = { month: Date; total: bigint; completed: bigint; onTime: bigint };
type SlaRow = { total: bigint; onTime: bigint };

function monthly(rows: CountRow[], start: Date) {
  const counts = new Map(
    rows.map((row) => [row.month.toISOString().slice(0, 7), Number(row.count)]),
  );
  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1))
      .toISOString()
      .slice(0, 7);
    return { month, count: counts.get(month) ?? 0 };
  });
}

export async function getEngineeringAnalytics(actor: EngineeringActor) {
  const projects = await listMyProjects(actor);
  const ids = projects.map((project) => project.id);
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1));
  const empty = monthly([], start);
  if (!ids.length)
    return {
      projectProgress: [],
      engineerWorkload: [],
      taskCompletion: empty,
      bugTrends: empty,
      releaseFrequency: empty,
      maintenancePerformance: empty.map((row) => ({
        month: row.month,
        total: 0,
        completed: 0,
        onTime: 0,
      })),
      slaCompliance: { total: 0, onTime: 0, percent: 0 },
    };
  const [
    taskGroups,
    workloadGroups,
    completionRows,
    bugRows,
    releaseRows,
    maintenanceRows,
    bugSla,
    maintenanceSla,
  ] = await Promise.all([
    prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: ids }, deletedAt: null, approvalStatus: 'APPROVED' },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: {
        projectId: { in: ids },
        deletedAt: null,
        approvalStatus: 'APPROVED',
        status: { notIn: ['DONE', 'CANCELLED'] },
        assigneeId: { not: null },
      },
      _count: { _all: true },
      _sum: { estimatedHours: true },
    }),
    prisma.$queryRaw<CountRow[]>(
      Prisma.sql`SELECT date_trunc('month', completed_at) AS month, COUNT(*)::bigint AS count FROM tasks WHERE project_id IN (${Prisma.join(ids)}) AND deleted_at IS NULL AND completed_at >= ${start} GROUP BY 1 ORDER BY 1`,
    ),
    prisma.$queryRaw<CountRow[]>(
      Prisma.sql`SELECT date_trunc('month', reported_at) AS month, COUNT(*)::bigint AS count FROM bug_reports WHERE project_id IN (${Prisma.join(ids)}) AND reported_at >= ${start} GROUP BY 1 ORDER BY 1`,
    ),
    prisma.$queryRaw<CountRow[]>(
      Prisma.sql`SELECT date_trunc('month', created_at) AS month, COUNT(*)::bigint AS count FROM releases WHERE project_id IN (${Prisma.join(ids)}) AND created_at >= ${start} GROUP BY 1 ORDER BY 1`,
    ),
    prisma.$queryRaw<MaintenanceRow[]>(
      Prisma.sql`SELECT date_trunc('month', created_at) AS month, COUNT(*)::bigint AS total, COUNT(completed_at)::bigint AS completed, COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND (resolution_due_at IS NULL OR completed_at <= resolution_due_at))::bigint AS "onTime" FROM maintenance_requests WHERE project_id IN (${Prisma.join(ids)}) AND created_at >= ${start} GROUP BY 1 ORDER BY 1`,
    ),
    prisma.$queryRaw<SlaRow[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS total, COUNT(*) FILTER (WHERE resolution_due_at IS NULL OR resolved_at <= resolution_due_at)::bigint AS "onTime" FROM bug_reports WHERE project_id IN (${Prisma.join(ids)}) AND resolved_at IS NOT NULL`,
    ),
    prisma.$queryRaw<SlaRow[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS total, COUNT(*) FILTER (WHERE resolution_due_at IS NULL OR completed_at <= resolution_due_at)::bigint AS "onTime" FROM maintenance_requests WHERE project_id IN (${Prisma.join(ids)}) AND completed_at IS NOT NULL`,
    ),
  ]);
  const totalByProject = new Map<string, { total: number; done: number }>();
  for (const group of taskGroups) {
    const current = totalByProject.get(group.projectId) ?? { total: 0, done: 0 };
    current.total += group._count._all;
    if (group.status === 'DONE') current.done += group._count._all;
    totalByProject.set(group.projectId, current);
  }
  const assigneeIds = workloadGroups.flatMap((group) =>
    group.assigneeId ? [group.assigneeId] : [],
  );
  const users = await prisma.user.findMany({
    where: { id: { in: assigneeIds } },
    select: { id: true, name: true, engineerProfile: { select: { weeklyCapacityHours: true } } },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));
  const slaTotal = Number(bugSla[0]?.total ?? 0) + Number(maintenanceSla[0]?.total ?? 0);
  const slaOnTime = Number(bugSla[0]?.onTime ?? 0) + Number(maintenanceSla[0]?.onTime ?? 0);
  const maintenanceByMonth = new Map(
    maintenanceRows.map((row) => [row.month.toISOString().slice(0, 7), row]),
  );
  return {
    projectProgress: projects.map((project) => {
      const counts = totalByProject.get(project.id) ?? { total: 0, done: 0 };
      return {
        projectId: project.id,
        name: project.name,
        ...counts,
        percent: counts.total ? Math.round((counts.done / counts.total) * 100) : 0,
      };
    }),
    engineerWorkload: workloadGroups.flatMap((group) => {
      const user = group.assigneeId ? usersById.get(group.assigneeId) : null;
      return user
        ? [
            {
              userId: user.id,
              name: user.name,
              activeTasks: group._count._all,
              estimatedHours: Number(group._sum.estimatedHours ?? 0),
              weeklyCapacityHours: Number(user.engineerProfile?.weeklyCapacityHours ?? 40),
            },
          ]
        : [];
    }),
    taskCompletion: monthly(completionRows, start),
    bugTrends: monthly(bugRows, start),
    releaseFrequency: monthly(releaseRows, start),
    maintenancePerformance: empty.map((entry) => {
      const row = maintenanceByMonth.get(entry.month);
      return {
        month: entry.month,
        total: Number(row?.total ?? 0),
        completed: Number(row?.completed ?? 0),
        onTime: Number(row?.onTime ?? 0),
      };
    }),
    slaCompliance: {
      total: slaTotal,
      onTime: slaOnTime,
      percent: slaTotal ? Math.round((slaOnTime / slaTotal) * 100) : 0,
    },
  };
}
