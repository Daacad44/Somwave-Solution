import { Prisma } from '@prisma/client';
import type {
  AddProjectMemberInput,
  CreateEngineeringTaskInput,
  ReviewEngineeringTaskInput,
  UpdateProjectMemberInput,
  CreateProjectPhaseInput,
  UpdateEngineerProfileInput,
  CreateEngineerAvailabilityInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { logger } from '../lib/logger';
import { emitNotification, type NotificationInput } from './notification-delivery.service';
import { decodeProjectFile } from './project-documentation.service';
import { putObject, readObject } from '../lib/storage';

async function notifyAfterWrite(input: NotificationInput): Promise<void> {
  try {
    await emitNotification(input);
  } catch (error) {
    logger.error(
      { err: error, eventKey: input.eventKey },
      'Engineering notification enqueue failed',
    );
  }
}

export type EngineeringActor = Pick<Express.AuthUserContext, 'id' | 'roles'>;

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
const ENGINEER_ROLES = new Set(['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER']);

function isAdmin(actor: EngineeringActor): boolean {
  return actor.roles.some((role) => ADMIN_ROLES.has(role));
}

async function access(projectId: string, actor: EngineeringActor) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, name: true, managerId: true },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: actor.id } },
    select: { role: true, removedAt: true },
  });
  const role = membership?.removedAt ? null : (membership?.role ?? null);
  const manage = isAdmin(actor) || project.managerId === actor.id || role === 'MANAGER';
  return { project, role, manage, view: manage || role !== null };
}

async function requireView(projectId: string, actor: EngineeringActor) {
  const result = await access(projectId, actor);
  if (!result.view) throw new AppError('NOT_FOUND', 404, 'Project not found');
  return result;
}

async function requireManager(projectId: string, actor: EngineeringActor) {
  const result = await access(projectId, actor);
  if (!result.view) throw new AppError('NOT_FOUND', 404, 'Project not found');
  if (!result.manage) throw new AppError('FORBIDDEN', 403, 'Project manager access required');
  return result;
}

async function requireEngineer(projectId: string, actor: EngineeringActor) {
  const result = await requireView(projectId, actor);
  if (!result.role || !ENGINEER_ROLES.has(result.role)) {
    throw new AppError('FORBIDDEN', 403, 'Active engineering membership required');
  }
  return result;
}

export async function listMyProjects(actor: EngineeringActor) {
  return prisma.project.findMany({
    where: {
      deletedAt: null,
      ...(isAdmin(actor)
        ? {}
        : {
            OR: [
              { managerId: actor.id },
              { members: { some: { userId: actor.id, removedAt: null } } },
            ],
          }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      dueDate: true,
      managerId: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Counts are calculated from records in projects visible to this actor. */
export async function getEngineeringMetrics(actor: EngineeringActor) {
  const visibleProjects = isAdmin(actor)
    ? { deletedAt: null }
    : {
        deletedAt: null,
        OR: [{ managerId: actor.id }, { members: { some: { userId: actor.id, removedAt: null } } }],
      };
  const projectRelation = { project: visibleProjects };
  const now = new Date();
  const [
    totalProjects,
    activeProjects,
    completedProjects,
    activeMembers,
    tasksInProgress,
    completedTasks,
    overdueTasks,
    pendingReviews,
    openBugs,
    criticalBugs,
    scheduledMaintenance,
    upcomingReleases,
  ] = await Promise.all([
    prisma.project.count({ where: visibleProjects }),
    prisma.project.count({ where: { ...visibleProjects, status: 'ACTIVE' } }),
    prisma.project.count({ where: { ...visibleProjects, status: 'COMPLETED' } }),
    prisma.projectMember.findMany({
      where: {
        removedAt: null,
        role: { in: ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER'] },
        ...projectRelation,
      },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.task.count({ where: { deletedAt: null, status: 'IN_PROGRESS', ...projectRelation } }),
    prisma.task.count({ where: { deletedAt: null, status: 'DONE', ...projectRelation } }),
    prisma.task.count({
      where: {
        deletedAt: null,
        dueDate: { lt: now },
        status: { notIn: ['DONE', 'CANCELLED'] },
        ...projectRelation,
      },
    }),
    prisma.task.count({
      where: {
        deletedAt: null,
        approvalStatus: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        ...projectRelation,
      },
    }),
    prisma.bugReport.count({
      where: { status: { notIn: ['RESOLVED', 'CLOSED'] }, ...projectRelation },
    }),
    prisma.bugReport.count({
      where: {
        severity: 'CRITICAL',
        status: { notIn: ['RESOLVED', 'CLOSED'] },
        ...projectRelation,
      },
    }),
    prisma.maintenanceRequest.count({ where: { status: 'SCHEDULED', ...projectRelation } }),
    prisma.release.count({
      where: {
        status: { in: ['PLANNED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED'] },
        ...projectRelation,
      },
    }),
  ]);
  return {
    totalProjects,
    activeProjects,
    completedProjects,
    activeEngineers: activeMembers.length,
    tasksInProgress,
    completedTasks,
    overdueTasks,
    pendingReviews,
    openBugs,
    criticalBugs,
    scheduledMaintenance,
    upcomingReleases,
  };
}

export async function listProjectMembers(projectId: string, actor: EngineeringActor) {
  await requireView(projectId, actor);
  return prisma.projectMember.findMany({
    where: { projectId, removedAt: null },
    select: {
      id: true,
      role: true,
      responsibilities: true,
      assignedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: 'asc' },
  });
}

export async function listEligibleEngineers(
  projectId: string,
  actor: EngineeringActor,
  search?: string,
) {
  await requireManager(projectId, actor);
  return prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      roles: { some: { role: { name: { in: ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER'] } } } },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: 50,
  });
}

export async function addProjectMember(
  projectId: string,
  actor: EngineeringActor,
  input: AddProjectMemberInput,
) {
  await requireManager(projectId, actor);
  const user = await prisma.user.findFirst({
    where: { id: input.userId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw new AppError('VALIDATION_ERROR', 400, 'Active user not found');
  const member = await prisma.$transaction(async (tx) => {
    if (input.role === 'LEAD_ENGINEER') {
      await tx.projectMember.updateMany({
        where: { projectId, role: 'LEAD_ENGINEER', removedAt: null },
        data: { role: 'ENGINEER' },
      });
    }
    const result = await tx.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: input.userId } },
      create: {
        projectId,
        userId: input.userId,
        role: input.role,
        responsibilities: input.responsibilities ?? null,
      },
      update: {
        role: input.role,
        responsibilities: input.responsibilities ?? null,
        removedAt: null,
        assignedAt: new Date(),
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        role: true,
        responsibilities: true,
        assignedAt: true,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'project.member.assign',
        subjectType: 'ProjectMember',
        subjectId: result.id,
      },
    });
    await tx.projectAssignmentEvent.create({
      data: {
        projectId,
        userId: input.userId,
        actorId: actor.id,
        action: 'ASSIGNED',
        role: input.role,
      },
    });
    return result;
  });
  await notifyAfterWrite({
    eventKey: 'project.assignment',
    userId: input.userId,
    title: 'Project assignment',
    body: 'You have been assigned to a project.',
    dedupeKey: 'project-assignment:' + member.id + ':' + member.assignedAt.toISOString(),
  });
  return member;
}

export async function updateProjectMember(
  projectId: string,
  userId: string,
  actor: EngineeringActor,
  input: UpdateProjectMemberInput,
) {
  await requireManager(projectId, actor);
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!existing || existing.removedAt)
    throw new AppError('NOT_FOUND', 404, 'Project member not found');
  return prisma.$transaction(async (tx) => {
    if (input.role === 'LEAD_ENGINEER') {
      await tx.projectMember.updateMany({
        where: { projectId, role: 'LEAD_ENGINEER', removedAt: null },
        data: { role: 'ENGINEER' },
      });
    }
    const member = await tx.projectMember.update({
      where: { id: existing.id },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.responsibilities !== undefined
          ? { responsibilities: input.responsibilities }
          : {}),
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        role: true,
        responsibilities: true,
        assignedAt: true,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'project.member.update',
        subjectType: 'ProjectMember',
        subjectId: member.id,
      },
    });
    await tx.projectAssignmentEvent.create({
      data: { projectId, userId, actorId: actor.id, action: 'UPDATED', role: member.role },
    });
    return member;
  });
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  actor: EngineeringActor,
) {
  await requireManager(projectId, actor);
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member || member.removedAt) throw new AppError('NOT_FOUND', 404, 'Project member not found');
  if (member.role === 'MANAGER' && !isAdmin(actor)) {
    throw new AppError('FORBIDDEN', 403, 'Only an administrator can remove a project manager');
  }
  await prisma.$transaction(async (tx) => {
    await tx.projectMember.update({ where: { id: member.id }, data: { removedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'project.member.remove',
        subjectType: 'ProjectMember',
        subjectId: member.id,
      },
    });
    await tx.projectAssignmentEvent.create({
      data: { projectId, userId, actorId: actor.id, action: 'REMOVED', role: member.role },
    });
  });
}

export async function listAssignmentHistory(projectId: string, actor: EngineeringActor) {
  await requireManager(projectId, actor);
  return prisma.projectAssignmentEvent.findMany({
    where: { projectId },
    orderBy: { occurredAt: 'desc' },
    take: 200,
  });
}

export async function getMyEngineerProfile(actor: EngineeringActor) {
  return prisma.engineerProfile.findUnique({ where: { userId: actor.id } });
}

export async function updateMyEngineerProfile(
  actor: EngineeringActor,
  input: UpdateEngineerProfileInput,
) {
  if (!actor.roles.some((role) => ENGINEER_ROLES.has(role)))
    throw new AppError('FORBIDDEN', 403, 'Engineer role required');
  const skills = input.skills ? [...new Set(input.skills.map((skill) => skill.trim()))] : undefined;
  const data = {
    ...(input.headline !== undefined ? { headline: input.headline } : {}),
    ...(skills ? { skills } : {}),
    ...(input.availability ? { availability: input.availability } : {}),
    ...(input.weeklyCapacityHours !== undefined
      ? { weeklyCapacityHours: new Prisma.Decimal(input.weeklyCapacityHours) }
      : {}),
    ...(input.timezone ? { timezone: input.timezone } : {}),
  };
  const profile = await prisma.engineerProfile.upsert({
    where: { userId: actor.id },
    create: { userId: actor.id, ...data },
    update: data,
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'engineer.profile.update',
      subjectType: 'EngineerProfile',
      subjectId: actor.id,
    },
  });
  return profile;
}

export async function listMyAvailability(actor: EngineeringActor) {
  return prisma.engineerAvailability.findMany({
    where: { userId: actor.id, endAt: { gte: new Date() } },
    orderBy: { startAt: 'asc' },
    take: 100,
  });
}

export async function addMyAvailability(
  actor: EngineeringActor,
  input: CreateEngineerAvailabilityInput,
) {
  if (!actor.roles.some((role) => ENGINEER_ROLES.has(role)))
    throw new AppError('FORBIDDEN', 403, 'Engineer role required');
  const slot = await prisma.engineerAvailability.create({
    data: {
      userId: actor.id,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      kind: input.kind,
      note: input.note ?? null,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'engineer.availability.add',
      subjectType: 'EngineerAvailability',
      subjectId: slot.id,
    },
  });
  return slot;
}

export async function removeMyAvailability(actor: EngineeringActor, slotId: string) {
  const removed = await prisma.engineerAvailability.deleteMany({
    where: { id: slotId, userId: actor.id },
  });
  if (!removed.count) throw new AppError('NOT_FOUND', 404, 'Availability slot not found');
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'engineer.availability.remove',
      subjectType: 'EngineerAvailability',
      subjectId: slotId,
    },
  });
  return { success: true };
}

export async function listProjectEngineerProfiles(projectId: string, actor: EngineeringActor) {
  await requireView(projectId, actor);
  const members = await prisma.projectMember.findMany({
    where: {
      projectId,
      removedAt: null,
      role: { in: ['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER'] },
    },
    select: {
      role: true,
      assignedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          engineerProfile: true,
          availabilitySlots: {
            where: { endAt: { gte: new Date() } },
            orderBy: { startAt: 'asc' },
            take: 30,
          },
        },
      },
    },
    orderBy: { assignedAt: 'asc' },
  });
  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } },
    select: { assigneeId: true, estimatedHours: true },
  });
  return members.map((member) => ({
    ...member,
    activeTaskCount: tasks.filter((task) => task.assigneeId === member.user.id).length,
    estimatedOpenHours: tasks
      .filter((task) => task.assigneeId === member.user.id)
      .reduce((sum, task) => sum + Number(task.estimatedHours ?? 0), 0),
  }));
}

export async function listProjectEngineeringTasks(projectId: string, actor: EngineeringActor) {
  const context = await requireView(projectId, actor);
  return prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(context.manage
        ? {}
        : {
            OR: [
              { approvalStatus: 'APPROVED' },
              { reporterId: actor.id },
              { assigneeId: actor.id },
            ],
          }),
    },
    select: {
      id: true,
      projectId: true,
      title: true,
      description: true,
      type: true,
      kind: true,
      phaseId: true,
      parentTaskId: true,
      milestoneId: true,
      startDate: true,
      progressPercent: true,
      blockedReason: true,
      qaVerifiedAt: true,
      priority: true,
      status: true,
      approvalStatus: true,
      estimatedHours: true,
      acceptanceCriteria: true,
      assigneeId: true,
      reporterId: true,
      dueDate: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNote: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createEngineeringTask(
  projectId: string,
  actor: EngineeringActor,
  input: CreateEngineeringTaskInput,
) {
  await requireEngineer(projectId, actor);
  const assigneeId = input.assigneeId ?? actor.id;
  const assignee = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } },
    select: { role: true, removedAt: true },
  });
  if (!assignee || assignee.removedAt || !ENGINEER_ROLES.has(assignee.role)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Assignee must be an active project engineer');
  }
  if (input.milestoneId) {
    const milestone = await prisma.milestone.findFirst({
      where: { id: input.milestoneId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!milestone)
      throw new AppError('VALIDATION_ERROR', 400, 'Milestone must belong to this project');
  }
  if (input.parentTaskId) {
    const parent = await prisma.task.findFirst({
      where: { id: input.parentTaskId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!parent)
      throw new AppError('VALIDATION_ERROR', 400, 'Parent task must belong to this project');
  }
  if (input.phaseId) {
    const phase = await prisma.projectPhase.findFirst({
      where: { id: input.phaseId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!phase) throw new AppError('VALIDATION_ERROR', 400, 'Phase must belong to this project');
  }
  if (input.dependencyIds?.length) {
    const uniqueIds = [...new Set(input.dependencyIds)];
    if (uniqueIds.length !== input.dependencyIds.length)
      throw new AppError('VALIDATION_ERROR', 400, 'Duplicate task dependencies');
    const count = await prisma.task.count({
      where: { id: { in: uniqueIds }, projectId, deletedAt: null },
    });
    if (count !== uniqueIds.length)
      throw new AppError('VALIDATION_ERROR', 400, 'Dependencies must belong to this project');
  }
  return prisma.task.create({
    data: {
      projectId,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      kind: input.kind ?? 'TASK',
      phaseId: input.phaseId ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      priority: input.priority,
      status: 'TODO',
      estimatedHours:
        input.estimatedHours === undefined ? null : new Prisma.Decimal(input.estimatedHours),
      acceptanceCriteria: input.acceptanceCriteria ?? null,
      assigneeId,
      reporterId: actor.id,
      milestoneId: input.milestoneId ?? null,
      parentTaskId: input.parentTaskId ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      approvalStatus: 'DRAFT',
      reviewRequired: true,
      ...(input.checklist?.length
        ? { checklist: { create: input.checklist.map((title, order) => ({ title, order })) } }
        : {}),
      ...(input.dependencyIds?.length
        ? { dependencies: { create: input.dependencyIds.map((dependsOnId) => ({ dependsOnId })) } }
        : {}),
    },
  });
}

export async function listProjectPhases(projectId: string, actor: EngineeringActor) {
  await requireView(projectId, actor);
  return prisma.projectPhase.findMany({
    where: { projectId, deletedAt: null },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createProjectPhase(
  projectId: string,
  actor: EngineeringActor,
  input: CreateProjectPhaseInput,
) {
  await requireManager(projectId, actor);
  if (input.startDate && input.dueDate && new Date(input.startDate) > new Date(input.dueDate)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Phase due date must follow start date');
  }
  const phase = await prisma.projectPhase.create({
    data: {
      projectId,
      title: input.title,
      description: input.description ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      order: input.order ?? 0,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'project.phase.create',
      subjectType: 'ProjectPhase',
      subjectId: phase.id,
    },
  });
  return phase;
}

async function taskForAction(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, project: { deletedAt: null } },
  });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Task not found');
  return task;
}

export async function submitEngineeringTask(taskId: string, actor: EngineeringActor) {
  const task = await taskForAction(taskId);
  await requireEngineer(task.projectId, actor);
  if (task.reporterId !== actor.id)
    throw new AppError('FORBIDDEN', 403, 'Only the author can submit this task');
  if (task.approvalStatus !== 'DRAFT' && task.approvalStatus !== 'CHANGES_REQUESTED') {
    throw new AppError('CONFLICT', 409, 'Task is not ready for submission');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        approvalStatus: 'SUBMITTED',
        submittedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
      },
    });
    await tx.taskReview.create({
      data: { taskId, authorId: actor.id, status: 'SUBMITTED' },
    });
    return updated;
  });
  const project = await prisma.project.findUnique({
    where: { id: task.projectId },
    select: { managerId: true },
  });
  if (project?.managerId && project.managerId !== actor.id) {
    await notifyAfterWrite({
      eventKey: 'task.review',
      userId: project.managerId,
      title: 'Task awaiting review',
      body: `Task ${task.title} was submitted for review.`,
      dedupeKey: 'task-submitted:' + taskId + ':' + (updated.submittedAt?.toISOString() ?? ''),
    });
  }
  return updated;
}

export async function reviewEngineeringTask(
  taskId: string,
  actor: EngineeringActor,
  input: ReviewEngineeringTaskInput,
) {
  const task = await taskForAction(taskId);
  await requireManager(task.projectId, actor);
  if (task.reviewRequired && task.reporterId === actor.id) {
    throw new AppError('FORBIDDEN', 403, 'An independent reviewer is required');
  }
  if (task.approvalStatus !== 'SUBMITTED' && task.approvalStatus !== 'UNDER_REVIEW') {
    throw new AppError('CONFLICT', 409, 'Task is not awaiting review');
  }
  if (input.decision === 'START_REVIEW' && task.approvalStatus !== 'SUBMITTED') {
    throw new AppError('CONFLICT', 409, 'Review has already started');
  }
  const approvalStatus = {
    START_REVIEW: 'UNDER_REVIEW',
    APPROVE: 'APPROVED',
    REQUEST_CHANGES: 'CHANGES_REQUESTED',
    REJECT: 'REJECTED',
  } as const;
  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        approvalStatus: approvalStatus[input.decision],
        reviewedById: actor.id,
        reviewedAt: input.decision === 'START_REVIEW' ? null : new Date(),
        reviewNote: input.note ?? null,
      },
    });
    await tx.taskReview.create({
      data: {
        taskId,
        authorId: task.reporterId ?? actor.id,
        reviewerId: actor.id,
        status: approvalStatus[input.decision],
        note: input.note ?? null,
      },
    });
    return updated;
  });
  if (task.reporterId && input.decision !== 'START_REVIEW') {
    await notifyAfterWrite({
      eventKey: 'task.review',
      userId: task.reporterId,
      title: input.decision === 'APPROVE' ? 'Task approved' : 'Task review update',
      body: `Review completed for ${task.title}.`,
      dedupeKey:
        'task-review:' +
        taskId +
        ':' +
        (updated.reviewedAt?.toISOString() ?? '') +
        ':' +
        input.decision,
    });
  }
  if (input.decision === 'APPROVE' && task.assigneeId && task.assigneeId !== task.reporterId) {
    await notifyAfterWrite({
      eventKey: 'task.assignment',
      userId: task.assigneeId,
      title: 'Task ready for work',
      body: `Task ${task.title} was approved and assigned to you.`,
      dedupeKey: `approved-task-assignment:${taskId}:${updated.reviewedAt?.toISOString() ?? ''}`,
    });
  }
  return updated;
}

async function visibleTask(taskId: string, actor: EngineeringActor) {
  const task = await taskForAction(taskId);
  const context = await requireView(task.projectId, actor);
  if (
    !context.manage &&
    task.approvalStatus !== 'APPROVED' &&
    task.reporterId !== actor.id &&
    task.assigneeId !== actor.id
  ) {
    throw new AppError('NOT_FOUND', 404, 'Task not found');
  }
  return { task, context };
}

export async function listTaskComments(taskId: string, actor: EngineeringActor) {
  await visibleTask(taskId, actor);
  return prisma.taskComment.findMany({
    where: { taskId, deletedAt: null },
    select: { id: true, body: true, authorId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function addTaskComment(taskId: string, actor: EngineeringActor, body: string) {
  await visibleTask(taskId, actor);
  const comment = await prisma.taskComment.create({ data: { taskId, authorId: actor.id, body } });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'task.comment.create',
      subjectType: 'TaskComment',
      subjectId: comment.id,
    },
  });
  return comment;
}

export async function listTaskProgress(taskId: string, actor: EngineeringActor) {
  await visibleTask(taskId, actor);
  return prisma.taskProgressReport.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function addTaskProgress(
  taskId: string,
  actor: EngineeringActor,
  input: { body: string; progressPercent: number; blockedReason?: string | null },
) {
  const { task, context } = await visibleTask(taskId, actor);
  if (task.assigneeId !== actor.id || !context.role || !ENGINEER_ROLES.has(context.role)) {
    throw new AppError('FORBIDDEN', 403, 'Only the assigned engineer can report progress');
  }
  if (task.approvalStatus !== 'APPROVED')
    throw new AppError('CONFLICT', 409, 'Approve the task before reporting progress');
  if (['DONE', 'CANCELLED'].includes(task.status))
    throw new AppError('CONFLICT', 409, 'Task is no longer active');
  return prisma.$transaction(async (tx) => {
    const report = await tx.taskProgressReport.create({
      data: {
        taskId,
        authorId: actor.id,
        body: input.body,
        progressPercent: input.progressPercent,
      },
    });
    await tx.task.update({
      where: { id: taskId },
      data: {
        progressPercent: input.progressPercent,
        ...(input.blockedReason !== undefined ? { blockedReason: input.blockedReason } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'task.progress.report',
        subjectType: 'TaskProgressReport',
        subjectId: report.id,
      },
    });
    return report;
  });
}

export async function listTaskChecklist(taskId: string, actor: EngineeringActor) {
  await visibleTask(taskId, actor);
  return prisma.taskChecklistItem.findMany({
    where: { taskId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function addTaskChecklistItem(taskId: string, actor: EngineeringActor, title: string) {
  const { task, context } = await visibleTask(taskId, actor);
  if (!context.manage && task.reporterId !== actor.id)
    throw new AppError('FORBIDDEN', 403, 'Only the manager or author can change the checklist');
  if (task.status === 'DONE')
    throw new AppError('CONFLICT', 409, 'Completed task checklist is locked');
  const item = await prisma.taskChecklistItem.create({ data: { taskId, title } });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'task.checklist.add',
      subjectType: 'TaskChecklistItem',
      subjectId: item.id,
    },
  });
  return item;
}

export async function setTaskChecklistItem(
  taskId: string,
  itemId: string,
  actor: EngineeringActor,
  completed: boolean,
) {
  const { task, context } = await visibleTask(taskId, actor);
  if (!context.manage && task.assigneeId !== actor.id)
    throw new AppError(
      'FORBIDDEN',
      403,
      'Only the assigned engineer or manager can complete checklist items',
    );
  if (task.approvalStatus !== 'APPROVED')
    throw new AppError('CONFLICT', 409, 'Task must be approved');
  const item = await prisma.taskChecklistItem.findFirst({ where: { id: itemId, taskId } });
  if (!item) throw new AppError('NOT_FOUND', 404, 'Checklist item not found');
  const updated = await prisma.taskChecklistItem.update({
    where: { id: itemId },
    data: { completedAt: completed ? new Date() : null },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: completed ? 'task.checklist.complete' : 'task.checklist.reopen',
      subjectType: 'TaskChecklistItem',
      subjectId: itemId,
    },
  });
  return updated;
}

export async function listTaskDependencies(taskId: string, actor: EngineeringActor) {
  await visibleTask(taskId, actor);
  return prisma.taskDependency.findMany({
    where: { taskId },
    include: { dependsOn: { select: { id: true, title: true, status: true } } },
  });
}

export async function addTaskDependency(
  taskId: string,
  actor: EngineeringActor,
  dependsOnId: string,
) {
  const { task, context } = await visibleTask(taskId, actor);
  if (!context.manage) throw new AppError('FORBIDDEN', 403, 'Project manager access required');
  if (taskId === dependsOnId)
    throw new AppError('VALIDATION_ERROR', 400, 'A task cannot depend on itself');
  const prerequisite = await prisma.task.findFirst({
    where: { id: dependsOnId, projectId: task.projectId, deletedAt: null },
    select: { id: true },
  });
  if (!prerequisite) throw new AppError('NOT_FOUND', 404, 'Prerequisite task not found');
  const edges = await prisma.taskDependency.findMany({
    where: { task: { projectId: task.projectId } },
    select: { taskId: true, dependsOnId: true },
    take: 10000,
  });
  const pending = [dependsOnId];
  const seen = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === taskId)
      throw new AppError('CONFLICT', 409, 'Task dependency would create a cycle');
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(
      ...edges.filter((edge) => edge.taskId === current).map((edge) => edge.dependsOnId),
    );
  }
  const dependency = await prisma.taskDependency.upsert({
    where: { taskId_dependsOnId: { taskId, dependsOnId } },
    create: { taskId, dependsOnId },
    update: {},
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'task.dependency.add',
      subjectType: 'Task',
      subjectId: taskId,
    },
  });
  return dependency;
}

export async function removeTaskDependency(
  taskId: string,
  actor: EngineeringActor,
  dependsOnId: string,
) {
  const { context } = await visibleTask(taskId, actor);
  if (!context.manage) throw new AppError('FORBIDDEN', 403, 'Project manager access required');
  await prisma.taskDependency.deleteMany({ where: { taskId, dependsOnId } });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'task.dependency.remove',
      subjectType: 'Task',
      subjectId: taskId,
    },
  });
  return { success: true };
}

export async function verifyTaskQa(taskId: string, actor: EngineeringActor) {
  const { task, context } = await visibleTask(taskId, actor);
  if (!context.manage && context.role !== 'QA_ENGINEER')
    throw new AppError('FORBIDDEN', 403, 'QA or project manager access required');
  if (task.assigneeId === actor.id)
    throw new AppError('FORBIDDEN', 403, 'An independent QA reviewer is required');
  if (task.status !== 'TESTING' || task.approvalStatus !== 'APPROVED')
    throw new AppError('CONFLICT', 409, 'Task must be approved and in testing');
  const changed = await prisma.task.updateMany({
    where: { id: taskId, status: 'TESTING', qaVerifiedAt: null },
    data: { qaVerifiedAt: new Date(), qaVerifiedById: actor.id },
  });
  if (!changed.count) throw new AppError('CONFLICT', 409, 'Task was already verified or changed');
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: 'task.qa.verify', subjectType: 'Task', subjectId: taskId },
  });
  return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
}

export async function listTaskTransitions(taskId: string, actor: EngineeringActor) {
  await visibleTask(taskId, actor);
  return prisma.taskTransition.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function scheduleTask(
  taskId: string,
  actor: EngineeringActor,
  input: { startDate: string | null; dueDate: string | null; phaseId?: string | null },
) {
  const { task, context } = await visibleTask(taskId, actor);
  if (!context.manage) throw new AppError('FORBIDDEN', 403, 'Project manager access required');
  if (input.phaseId) {
    const phase = await prisma.projectPhase.findFirst({
      where: { id: input.phaseId, projectId: task.projectId, deletedAt: null },
      select: { id: true },
    });
    if (!phase) throw new AppError('VALIDATION_ERROR', 400, 'Phase must belong to this project');
  }
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      ...(input.phaseId !== undefined ? { phaseId: input.phaseId } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'task.schedule.update',
      subjectType: 'Task',
      subjectId: taskId,
    },
  });
  return updated;
}

export async function listTaskHours(taskId: string, actor: EngineeringActor) {
  await visibleTask(taskId, actor);
  return prisma.taskTimeEntry.findMany({ where: { taskId }, orderBy: { date: 'desc' }, take: 100 });
}

export async function recordTaskHours(
  taskId: string,
  actor: EngineeringActor,
  input: { minutes: number; date: string; note?: string },
) {
  const { task, context } = await visibleTask(taskId, actor);
  if (task.assigneeId !== actor.id || !context.role || !ENGINEER_ROLES.has(context.role)) {
    throw new AppError('FORBIDDEN', 403, 'Only the assigned engineer may record task hours');
  }
  if (task.approvalStatus !== 'APPROVED')
    throw new AppError('CONFLICT', 409, 'Task must be approved');
  const date = new Date(`${input.date}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.date)
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid work date');
  const entry = await prisma.taskTimeEntry.create({
    data: { taskId, userId: actor.id, minutes: input.minutes, date, note: input.note ?? null },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'task.hours.record',
      subjectType: 'TaskTimeEntry',
      subjectId: entry.id,
    },
  });
  return entry;
}

export async function listTaskAttachments(taskId: string, actor: EngineeringActor) {
  await visibleTask(taskId, actor);
  return prisma.taskAttachment.findMany({
    where: { taskId },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addTaskAttachment(
  taskId: string,
  actor: EngineeringActor,
  input: { fileName: string; mimeType: string; contentBase64: string },
) {
  const { task, context } = await visibleTask(taskId, actor);
  if (!context.manage && task.assigneeId !== actor.id && task.reporterId !== actor.id) {
    throw new AppError('FORBIDDEN', 403, 'Task assignment required to upload attachments');
  }
  const bytes = decodeProjectFile(input.contentBase64, input.mimeType);
  const storageKey = await putObject(bytes, input.mimeType);
  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId,
      storageKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: bytes.length,
    },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'task.attachment.add',
      subjectType: 'TaskAttachment',
      subjectId: attachment.id,
    },
  });
  return attachment;
}

export async function getTaskAttachment(
  taskId: string,
  attachmentId: string,
  actor: EngineeringActor,
) {
  await visibleTask(taskId, actor);
  const attachment = await prisma.taskAttachment.findFirst({ where: { id: attachmentId, taskId } });
  if (!attachment) throw new AppError('NOT_FOUND', 404, 'Task attachment not found');
  const bytes = await readObject(attachment.storageKey);
  if (!bytes) throw new AppError('NOT_FOUND', 404, 'Task attachment data not found');
  return { bytes, mimeType: attachment.mimeType, fileName: attachment.fileName };
}
