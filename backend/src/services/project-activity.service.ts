import type { AuthUser, ProjectActivity } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { projectScope } from './project.service';

/** A project-scoped activity stream; never returns global audit records. */
export async function getProjectActivity(
  projectId: string,
  actor: AuthUser,
): Promise<ProjectActivity> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null, ...projectScope(actor) },
    select: { id: true },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  const [tasks, milestones, documents, bugs, maintenance, expenses, invitations, assignments] =
    await Promise.all([
      prisma.task.findMany({ where: { projectId }, select: { id: true } }),
      prisma.milestone.findMany({ where: { projectId }, select: { id: true } }),
      prisma.projectDocumentation.findMany({ where: { projectId }, select: { id: true } }),
      prisma.bugReport.findMany({ where: { projectId }, select: { id: true } }),
      prisma.maintenanceRequest.findMany({ where: { projectId }, select: { id: true } }),
      prisma.projectExpense.findMany({ where: { projectId }, select: { id: true } }),
      prisma.projectInvitation.findMany({ where: { projectId }, select: { id: true } }),
      prisma.projectAssignmentEvent.findMany({
        where: { projectId },
        orderBy: { occurredAt: 'desc' },
        take: 100,
      }),
    ]);
  const related = [
    ['Task', tasks],
    ['Milestone', milestones],
    ['ProjectDocumentation', documents],
    ['BugReport', bugs],
    ['MaintenanceRequest', maintenance],
    ['ProjectExpense', expenses],
    ['ProjectInvitation', invitations],
  ] as const;
  const audits = await prisma.auditLog.findMany({
    where: {
      OR: [
        { subjectType: 'Project', subjectId: projectId },
        ...related
          .filter(([, rows]) => rows.length)
          .map(([subjectType, rows]) => ({
            subjectType,
            subjectId: { in: rows.map((row) => row.id) },
          })),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      action: true,
      subjectType: true,
      subjectId: true,
      actorId: true,
      createdAt: true,
    },
  });
  const actorIds = [
    ...new Set(
      [
        ...audits.map((event) => event.actorId),
        ...assignments.map((event) => event.actorId),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const users = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(users.map((user) => [user.id, user.name]));
  return [
    ...audits.map((event) => ({
      id: event.id,
      action: event.action,
      resourceType: event.subjectType,
      resourceId: event.subjectId,
      actorId: event.actorId,
      actorName: event.actorId ? (names.get(event.actorId) ?? null) : null,
      occurredAt: event.createdAt.toISOString(),
    })),
    ...assignments.map((event) => ({
      id: event.id,
      action: `assignment.${event.action.toLowerCase()}`,
      resourceType: 'ProjectAssignment',
      resourceId: event.userId,
      actorId: event.actorId,
      actorName: names.get(event.actorId) ?? null,
      occurredAt: event.occurredAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 100);
}
