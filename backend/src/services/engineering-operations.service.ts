import type {
  CreateBugReportInput,
  CreateMaintenanceRequestInput,
  CreateManagedSystemInput,
  CreateReleaseInput,
  CreateSystemUpdateInput,
  RecordDeploymentInput,
  TransitionReleaseInput,
  TransitionSystemUpdateInput,
  UpdateBugReportInput,
  UpdateMaintenanceRequestInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { writeAudit } from '../lib/audit';
import { logger } from '../lib/logger';
import { emitNotification, type NotificationEvent } from './notification-delivery.service';

type Actor = Express.AuthUserContext;

const BUG_SLA_HOURS = {
  CRITICAL: [1, 4],
  HIGH: [4, 24],
  MEDIUM: [24, 72],
  LOW: [72, 168],
} as const;
const MAINTENANCE_SLA_HOURS = {
  EMERGENCY: [1, 4],
  INCIDENT: [4, 24],
  SECURITY_PATCH: [8, 48],
  CORRECTIVE: [24, 72],
  PREVENTIVE: [72, 168],
  SCHEDULED: [72, 168],
  HEALTH_CHECK: [72, 168],
} as const;

function dueAt(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

function slaState(
  row: {
    responseDueAt: Date | null;
    resolutionDueAt: Date | null;
    respondedAt: Date | null;
    completedAt?: Date | null;
    resolvedAt?: Date | null;
  },
  now = new Date(),
) {
  const responseOverdue = Boolean(
    row.responseDueAt &&
    (!row.respondedAt || row.respondedAt > row.responseDueAt) &&
    now > row.responseDueAt,
  );
  const resolutionTime = row.completedAt ?? row.resolvedAt;
  const resolutionOverdue = Boolean(
    row.resolutionDueAt &&
    (!resolutionTime || resolutionTime > row.resolutionDueAt) &&
    now > row.resolutionDueAt,
  );
  return { responseOverdue, resolutionOverdue };
}

async function notifyUser(
  userId: string | null | undefined,
  title: string,
  body: string,
  eventKey: NotificationEvent,
  dedupeKey: string,
) {
  if (!userId) return;
  try {
    await emitNotification({ userId, title, body, eventKey, dedupeKey });
  } catch (error) {
    logger.error({ err: error, eventKey }, 'Operations notification enqueue failed');
  }
}

function isAdmin(actor: Actor): boolean {
  return actor.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN');
}

async function projectAccess(projectId: string, actor: Actor, manage = false): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, managerId: true },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  if (isAdmin(actor)) return true;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: actor.id } },
    select: { role: true, removedAt: true },
  });
  const activeRole = member && !member.removedAt ? member.role : null;
  if (!activeRole && project.managerId !== actor.id) {
    throw new AppError('NOT_FOUND', 404, 'Project not found');
  }
  const canManage = activeRole === 'MANAGER' || project.managerId === actor.id;
  if (manage && !canManage) {
    throw new AppError('FORBIDDEN', 403, 'Project manager access required');
  }
  return canManage;
}

async function systemAccess(systemId: string, actor: Actor, manage = false) {
  const system = await prisma.managedSystem.findFirst({
    where: { id: systemId, deletedAt: null, project: { deletedAt: null } },
    select: { id: true, projectId: true },
  });
  if (!system) throw new AppError('NOT_FOUND', 404, 'Managed system not found');
  await projectAccess(system.projectId, actor, manage);
  return system;
}

async function activeEngineer(projectId: string, userId: string): Promise<void> {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true, removedAt: true },
  });
  if (
    !member ||
    member.removedAt ||
    !['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER'].includes(member.role)
  ) {
    throw new AppError('VALIDATION_ERROR', 400, 'Assignee must be an active project engineer');
  }
}

export async function listSystems(projectId: string, actor: Actor) {
  await projectAccess(projectId, actor);
  return prisma.managedSystem.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createSystem(
  projectId: string,
  actor: Actor,
  input: CreateManagedSystemInput,
) {
  await projectAccess(projectId, actor, true);
  if (input.assignedEngineerId) await activeEngineer(projectId, input.assignedEngineerId);
  const system = await prisma.managedSystem.create({
    data: {
      projectId,
      name: input.name,
      description: input.description ?? null,
      technologyStack: input.technologyStack,
      productionUrl: input.productionUrl ?? null,
      stagingUrl: input.stagingUrl ?? null,
      hostingProvider: input.hostingProvider ?? null,
      assignedEngineerId: input.assignedEngineerId ?? null,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'managedSystem.create',
    subjectType: 'ManagedSystem',
    subjectId: system.id,
  });
  return system;
}

export async function listUpdates(systemId: string, actor: Actor) {
  await systemAccess(systemId, actor);
  return prisma.systemUpdate.findMany({ where: { systemId }, orderBy: { createdAt: 'desc' } });
}

export async function createUpdate(systemId: string, actor: Actor, input: CreateSystemUpdateInput) {
  const system = await systemAccess(systemId, actor, true);
  const update = await prisma.systemUpdate.create({
    data: {
      systemId,
      projectId: system.projectId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'systemUpdate.create',
    subjectType: 'SystemUpdate',
    subjectId: update.id,
  });
  return update;
}

const UPDATE_TRANSITIONS: Record<string, readonly string[]> = {
  REQUESTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_DEVELOPMENT', 'CANCELLED'],
  IN_DEVELOPMENT: ['CODE_REVIEW', 'CANCELLED'],
  CODE_REVIEW: ['IN_DEVELOPMENT', 'TESTING', 'CANCELLED'],
  TESTING: ['IN_DEVELOPMENT', 'STAGING', 'CANCELLED'],
  STAGING: ['TESTING', 'PRODUCTION_APPROVAL', 'CANCELLED'],
  PRODUCTION_APPROVAL: ['DEPLOYED', 'CANCELLED'],
  DEPLOYED: ['VERIFIED'],
  VERIFIED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export async function transitionUpdate(
  updateId: string,
  actor: Actor,
  input: TransitionSystemUpdateInput,
) {
  const update = await prisma.systemUpdate.findUnique({ where: { id: updateId } });
  if (!update) throw new AppError('NOT_FOUND', 404, 'System update not found');
  await projectAccess(update.projectId, actor, true);
  if (!UPDATE_TRANSITIONS[update.status]?.includes(input.status)) {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot move update from ${update.status} to ${input.status}`,
    );
  }
  if (input.status === 'DEPLOYED' && !update.productionApprovedAt) {
    throw new AppError('FORBIDDEN', 403, 'Production approval is required');
  }
  const changed = await prisma.systemUpdate.updateMany({
    where: { id: updateId, status: update.status },
    data: {
      status: input.status,
      deployedAt: input.status === 'DEPLOYED' ? new Date() : undefined,
    },
  });
  if (!changed.count) throw new AppError('CONFLICT', 409, 'Update was changed by another user');
  await writeAudit({
    actorId: actor.id,
    action: `systemUpdate.${input.status.toLowerCase()}`,
    subjectType: 'SystemUpdate',
    subjectId: updateId,
  });
  return prisma.systemUpdate.findUniqueOrThrow({ where: { id: updateId } });
}

export async function approveUpdateProduction(updateId: string, actor: Actor) {
  const update = await prisma.systemUpdate.findUnique({ where: { id: updateId } });
  if (!update) throw new AppError('NOT_FOUND', 404, 'System update not found');
  await projectAccess(update.projectId, actor, true);
  if (!isAdmin(actor)) throw new AppError('FORBIDDEN', 403, 'Administrator approval required');
  if (update.status !== 'PRODUCTION_APPROVAL' || update.productionApprovedAt) {
    throw new AppError('CONFLICT', 409, 'Update is not awaiting production approval');
  }
  const changed = await prisma.systemUpdate.updateMany({
    where: { id: updateId, status: 'PRODUCTION_APPROVAL', productionApprovedAt: null },
    data: { productionApprovedById: actor.id, productionApprovedAt: new Date() },
  });
  if (!changed.count) throw new AppError('CONFLICT', 409, 'Update was changed by another user');
  await writeAudit({
    actorId: actor.id,
    action: 'systemUpdate.productionApproved',
    subjectType: 'SystemUpdate',
    subjectId: updateId,
  });
  return prisma.systemUpdate.findUniqueOrThrow({ where: { id: updateId } });
}

export async function listBugs(systemId: string, actor: Actor) {
  await systemAccess(systemId, actor);
  const bugs = await prisma.bugReport.findMany({
    where: { systemId },
    orderBy: { reportedAt: 'desc' },
  });
  return bugs.map((bug) => ({ ...bug, sla: slaState(bug) }));
}

export async function createBug(systemId: string, actor: Actor, input: CreateBugReportInput) {
  const system = await systemAccess(systemId, actor);
  const now = new Date();
  const [responseHours, resolutionHours] = BUG_SLA_HOURS[input.severity];
  const bug = await prisma.bugReport.create({
    data: {
      systemId,
      projectId: system.projectId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      priority: input.priority,
      environment: input.environment ?? null,
      reproductionSteps: input.reproductionSteps ?? null,
      expectedResult: input.expectedResult ?? null,
      actualResult: input.actualResult ?? null,
      responseDueAt: dueAt(now, responseHours),
      resolutionDueAt: dueAt(now, resolutionHours),
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'bugReport.create',
    subjectType: 'BugReport',
    subjectId: bug.id,
  });
  if (input.severity === 'CRITICAL') {
    const managers = await prisma.projectMember.findMany({
      where: { projectId: system.projectId, role: 'MANAGER', removedAt: null },
      select: { userId: true },
    });
    for (const manager of managers) {
      await notifyUser(
        manager.userId,
        'Critical bug reported',
        `${input.title} requires triage.`,
        'bug.critical',
        'critical-bug:' + bug.id + ':' + manager.userId,
      );
    }
  }
  return { ...bug, sla: slaState(bug) };
}

export async function updateBug(bugId: string, actor: Actor, input: UpdateBugReportInput) {
  const bug = await prisma.bugReport.findUnique({
    where: { id: bugId },
    select: { id: true, projectId: true, status: true, assigneeId: true, title: true },
  });
  if (!bug) throw new AppError('NOT_FOUND', 404, 'Bug report not found');
  const canManage = await projectAccess(bug.projectId, actor);
  if (!canManage && bug.assigneeId !== actor.id) {
    throw new AppError(
      'FORBIDDEN',
      403,
      'Only the assigned engineer or project manager may update this bug',
    );
  }
  if (!canManage && (input.assigneeId !== undefined || input.status === 'CLOSED')) {
    throw new AppError('FORBIDDEN', 403, 'Only a project manager may assign or close a bug');
  }
  if (input.assigneeId) await activeEngineer(bug.projectId, input.assigneeId);
  if (input.status === 'REOPENED' && !['RESOLVED', 'CLOSED'].includes(bug.status)) {
    throw new AppError('CONFLICT', 409, 'Only resolved or closed bugs can be reopened');
  }
  if (input.status === 'CLOSED' && bug.status !== 'RESOLVED') {
    throw new AppError('CONFLICT', 409, 'Resolve the bug before closing it');
  }
  const allowedBugTransitions: Record<string, readonly string[]> = {
    REPORTED: ['TRIAGED', 'ASSIGNED'],
    TRIAGED: ['ASSIGNED'],
    ASSIGNED: ['IN_PROGRESS'],
    IN_PROGRESS: ['CODE_REVIEW', 'TESTING', 'RESOLVED'],
    CODE_REVIEW: ['IN_PROGRESS', 'TESTING'],
    TESTING: ['IN_PROGRESS', 'RESOLVED'],
    RESOLVED: ['CLOSED', 'REOPENED'],
    CLOSED: ['REOPENED'],
    REOPENED: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS'],
  };
  if (!allowedBugTransitions[bug.status]?.includes(input.status)) {
    throw new AppError('CONFLICT', 409, `Cannot move a bug from ${bug.status} to ${input.status}`);
  }
  if (input.status === 'ASSIGNED' && !(input.assigneeId ?? bug.assigneeId)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Assign an engineer before moving to ASSIGNED');
  }
  if (input.status === 'RESOLVED' && !input.rootCause) {
    throw new AppError('VALIDATION_ERROR', 400, 'A root cause is required to resolve a bug');
  }
  const updated = await prisma.bugReport.update({
    where: { id: bugId },
    data: {
      status: input.status,
      ...(input.rootCause !== undefined ? { rootCause: input.rootCause } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      resolvedAt:
        input.status === 'RESOLVED' ? new Date() : input.status === 'REOPENED' ? null : undefined,
      respondedAt: bug.status === 'REPORTED' ? new Date() : undefined,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'bugReport.update',
    subjectType: 'BugReport',
    subjectId: bugId,
  });
  if (input.assigneeId && input.assigneeId !== bug.assigneeId) {
    await notifyUser(
      input.assigneeId,
      'Bug assigned',
      `${bug.title} was assigned to you.`,
      'bug.assignment',
      'bug-assignment:' + bugId + ':' + input.assigneeId + ':' + updated.updatedAt.toISOString(),
    );
  }
  return { ...updated, sla: slaState(updated) };
}

export async function listMaintenance(systemId: string, actor: Actor) {
  await systemAccess(systemId, actor);
  const requests = await prisma.maintenanceRequest.findMany({
    where: { systemId },
    orderBy: { createdAt: 'desc' },
  });
  return requests.map((request) => ({ ...request, sla: slaState(request) }));
}

export async function createMaintenance(
  systemId: string,
  actor: Actor,
  input: CreateMaintenanceRequestInput,
) {
  const system = await systemAccess(systemId, actor, true);
  if (input.assigneeId) await activeEngineer(system.projectId, input.assigneeId);
  const now = new Date();
  const [responseHours, resolutionHours] = MAINTENANCE_SLA_HOURS[input.type];
  const responseDueAt = input.responseDueAt
    ? new Date(input.responseDueAt)
    : dueAt(now, responseHours);
  const resolutionDueAt = input.resolutionDueAt
    ? new Date(input.resolutionDueAt)
    : dueAt(now, resolutionHours);
  if (responseDueAt <= now || resolutionDueAt <= responseDueAt) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'SLA deadlines must be future dates in response-before-resolution order',
    );
  }
  const request = await prisma.maintenanceRequest.create({
    data: {
      systemId,
      projectId: system.projectId,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      assigneeId: input.assigneeId ?? null,
      recurrenceRule: input.recurrenceRule ?? null,
      responseDueAt,
      resolutionDueAt,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'maintenanceRequest.create',
    subjectType: 'MaintenanceRequest',
    subjectId: request.id,
  });
  await notifyUser(
    input.assigneeId,
    'Maintenance assigned',
    `${request.title} was assigned to you.`,
    'maintenance.schedule',
    'maintenance-assignment:' + request.id + ':' + input.assigneeId,
  );
  return { ...request, sla: slaState(request) };
}

const MAINTENANCE_TRANSITIONS: Record<string, readonly string[]> = {
  REQUESTED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function nextMaintenanceDate(scheduledAt: Date, rule: string, after: Date): Date {
  const match = /^FREQ=(DAILY|WEEKLY|MONTHLY)(?:;INTERVAL=([1-9]\d{0,2}))?$/.exec(rule);
  if (!match) throw new AppError('VALIDATION_ERROR', 400, 'Invalid maintenance recurrence');
  const interval = Number(match[2] ?? 1);
  const next = new Date(scheduledAt);
  for (let step = 0; step < 1200 && next <= after; step += 1) {
    if (match[1] === 'DAILY') next.setUTCDate(next.getUTCDate() + interval);
    else if (match[1] === 'WEEKLY') next.setUTCDate(next.getUTCDate() + 7 * interval);
    else next.setUTCMonth(next.getUTCMonth() + interval);
  }
  if (next <= after)
    throw new AppError('CONFLICT', 409, 'Could not calculate next maintenance date');
  return next;
}

export async function updateMaintenance(
  requestId: string,
  actor: Actor,
  input: UpdateMaintenanceRequestInput,
) {
  const request = await prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new AppError('NOT_FOUND', 404, 'Maintenance request not found');
  const canManage = await projectAccess(request.projectId, actor);
  if (!canManage && request.assigneeId !== actor.id) {
    throw new AppError(
      'FORBIDDEN',
      403,
      'Only the assigned engineer or project manager may update maintenance',
    );
  }
  if (!canManage && (input.assigneeId !== undefined || input.status === 'CANCELLED')) {
    throw new AppError(
      'FORBIDDEN',
      403,
      'Only a project manager may reassign or cancel maintenance',
    );
  }
  if (!MAINTENANCE_TRANSITIONS[request.status]?.includes(input.status)) {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot move maintenance from ${request.status} to ${input.status}`,
    );
  }
  if (input.assigneeId) await activeEngineer(request.projectId, input.assigneeId);
  const assigneeId = input.assigneeId === undefined ? request.assigneeId : input.assigneeId;
  if (input.status === 'IN_PROGRESS' && !assigneeId) {
    throw new AppError('VALIDATION_ERROR', 400, 'Assign an engineer before starting maintenance');
  }
  const scheduledAt =
    input.scheduledAt === undefined
      ? request.scheduledAt
      : input.scheduledAt
        ? new Date(input.scheduledAt)
        : null;
  if (input.status === 'SCHEDULED' && !scheduledAt) {
    throw new AppError('VALIDATION_ERROR', 400, 'A scheduled date is required');
  }
  if (request.recurrenceRule && !scheduledAt) {
    throw new AppError('VALIDATION_ERROR', 400, 'Recurring maintenance needs its scheduled date');
  }
  if (input.status === 'COMPLETED' && !input.resolutionNotes) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Resolution notes are required to complete maintenance',
    );
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const changed = await tx.maintenanceRequest.updateMany({
      where: { id: requestId, status: request.status },
      data: {
        status: input.status,
        assigneeId,
        scheduledAt,
        rootCause: input.rootCause ?? undefined,
        resolutionNotes: input.resolutionNotes ?? undefined,
        respondedAt: input.status === 'IN_PROGRESS' && !request.respondedAt ? now : undefined,
        completedAt: input.status === 'COMPLETED' ? now : undefined,
      },
    });
    if (!changed.count)
      throw new AppError('CONFLICT', 409, 'Maintenance was changed by another user');
    if (input.status === 'COMPLETED' && request.recurrenceRule && scheduledAt) {
      const nextAt = nextMaintenanceDate(
        scheduledAt,
        request.recurrenceRule,
        new Date(Math.max(now.getTime(), scheduledAt.getTime())),
      );
      const [responseHours, resolutionHours] = MAINTENANCE_SLA_HOURS[request.type];
      await tx.maintenanceRequest.create({
        data: {
          projectId: request.projectId,
          systemId: request.systemId,
          title: request.title,
          description: request.description,
          type: request.type,
          status: 'SCHEDULED',
          assigneeId,
          scheduledAt: nextAt,
          recurrenceRule: request.recurrenceRule,
          responseDueAt: dueAt(nextAt, responseHours),
          resolutionDueAt: dueAt(nextAt, resolutionHours),
        },
      });
    }
  });
  const updated = await prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: requestId } });
  await writeAudit({
    actorId: actor.id,
    action: `maintenanceRequest.${input.status.toLowerCase()}`,
    subjectType: 'MaintenanceRequest',
    subjectId: requestId,
  });
  if (assigneeId && assigneeId !== request.assigneeId) {
    await notifyUser(
      assigneeId,
      'Maintenance assigned',
      `${request.title} was assigned to you.`,
      'maintenance.schedule',
      'maintenance-assignment:' +
        requestId +
        ':' +
        assigneeId +
        ':' +
        updated.updatedAt.toISOString(),
    );
  }
  return { ...updated, sla: slaState(updated) };
}

export async function listReleases(systemId: string, actor: Actor) {
  await systemAccess(systemId, actor);
  return prisma.release.findMany({
    where: { systemId },
    orderBy: { createdAt: 'desc' },
    include: {
      taskLinks: {
        include: {
          task: {
            select: {
              id: true,
              title: true,
              githubLinks: {
                where: { kind: 'PULL_REQUEST' },
                select: { id: true, url: true, title: true, state: true },
              },
            },
          },
        },
      },
      pullRequestLinks: {
        include: {
          githubTaskLink: {
            select: {
              id: true,
              url: true,
              title: true,
              state: true,
              number: true,
              repository: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });
}

export async function changeReleaseTask(
  releaseId: string,
  taskId: string,
  actor: Actor,
  add: boolean,
) {
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: { id: true, projectId: true },
  });
  if (!release) throw new AppError('NOT_FOUND', 404, 'Release not found');
  await projectAccess(release.projectId, actor, true);
  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId: release.projectId, deletedAt: null },
    select: { id: true },
  });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Task not found in release project');
  if (add)
    await prisma.releaseTask.upsert({
      where: { releaseId_taskId: { releaseId, taskId } },
      update: {},
      create: { releaseId, taskId },
    });
  else await prisma.releaseTask.deleteMany({ where: { releaseId, taskId } });
  await writeAudit({
    actorId: actor.id,
    action: add ? 'release.task.link' : 'release.task.unlink',
    subjectType: 'Release',
    subjectId: releaseId,
  });
  return { releaseId, taskId, linked: add };
}

export async function listProjectPullRequests(projectId: string, actor: Actor) {
  await projectAccess(projectId, actor);
  return prisma.gitHubTaskLink.findMany({
    where: {
      kind: 'PULL_REQUEST',
      task: { projectId, deletedAt: null },
      repository: { projectId, isActive: true },
    },
    select: {
      id: true,
      url: true,
      title: true,
      state: true,
      number: true,
      repository: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function changeReleasePullRequest(
  releaseId: string,
  linkId: string,
  actor: Actor,
  add: boolean,
) {
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: { id: true, projectId: true },
  });
  if (!release) throw new AppError('NOT_FOUND', 404, 'Release not found');
  await projectAccess(release.projectId, actor, true);
  if (add) {
    const link = await prisma.gitHubTaskLink.findFirst({
      where: {
        id: linkId,
        kind: 'PULL_REQUEST',
        task: { projectId: release.projectId, deletedAt: null },
        repository: { projectId: release.projectId, isActive: true },
      },
      select: { id: true },
    });
    if (!link) throw new AppError('NOT_FOUND', 404, 'Project pull request not found');
    await prisma.releasePullRequest.upsert({
      where: { releaseId_githubTaskLinkId: { releaseId, githubTaskLinkId: linkId } },
      update: {},
      create: { releaseId, githubTaskLinkId: linkId },
    });
  } else {
    const removed = await prisma.releasePullRequest.deleteMany({
      where: { releaseId, githubTaskLinkId: linkId },
    });
    if (!removed.count) throw new AppError('NOT_FOUND', 404, 'Release pull request link not found');
  }
  await writeAudit({
    actorId: actor.id,
    action: add ? 'release.pullRequest.link' : 'release.pullRequest.unlink',
    subjectType: 'Release',
    subjectId: releaseId,
  });
  return { releaseId, linkId, linked: add };
}

export async function createRelease(systemId: string, actor: Actor, input: CreateReleaseInput) {
  const system = await systemAccess(systemId, actor, true);
  const release = await prisma.release.create({
    data: {
      systemId,
      projectId: system.projectId,
      version: input.version,
      notes: input.notes ?? null,
      rollbackPlan: input.rollbackPlan,
      ownerId: actor.id,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'release.create',
    subjectType: 'Release',
    subjectId: release.id,
  });
  return release;
}

export async function approveRelease(releaseId: string, actor: Actor) {
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: { id: true, projectId: true, status: true, ownerId: true },
  });
  if (!release) throw new AppError('NOT_FOUND', 404, 'Release not found');
  await projectAccess(release.projectId, actor, true);
  if (!isAdmin(actor)) throw new AppError('FORBIDDEN', 403, 'Administrator approval required');
  if (release.status !== 'PENDING_APPROVAL') {
    throw new AppError('CONFLICT', 409, 'Release cannot be approved in its current state');
  }
  const approved = await prisma.release.update({
    where: { id: releaseId },
    data: { status: 'APPROVED', approvedById: actor.id, approvedAt: new Date() },
  });
  await writeAudit({
    actorId: actor.id,
    action: 'release.approve',
    subjectType: 'Release',
    subjectId: releaseId,
  });
  return approved;
}

const RELEASE_TRANSITIONS: Record<string, readonly string[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['IN_PROGRESS', 'CANCELLED'],
  APPROVED: ['DEPLOYED', 'CANCELLED'],
  DEPLOYED: ['VERIFIED', 'ROLLED_BACK'],
  VERIFIED: ['ROLLED_BACK'],
  ROLLED_BACK: [],
  CANCELLED: [],
};

export async function transitionRelease(
  releaseId: string,
  actor: Actor,
  input: TransitionReleaseInput,
) {
  const release = await prisma.release.findUnique({ where: { id: releaseId } });
  if (!release) throw new AppError('NOT_FOUND', 404, 'Release not found');
  await projectAccess(release.projectId, actor, true);
  if (!RELEASE_TRANSITIONS[release.status]?.includes(input.status)) {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot move release from ${release.status} to ${input.status}`,
    );
  }
  if (
    input.status === 'VERIFIED' &&
    !(await prisma.deployment.findFirst({
      where: { releaseId, environment: 'PRODUCTION', status: 'SUCCEEDED' },
    }))
  ) {
    throw new AppError('CONFLICT', 409, 'A successful production deployment record is required');
  }
  const changed = await prisma.release.updateMany({
    where: { id: releaseId, status: release.status },
    data: { status: input.status },
  });
  if (!changed.count) throw new AppError('CONFLICT', 409, 'Release was changed by another user');
  await writeAudit({
    actorId: actor.id,
    action: `release.${input.status.toLowerCase()}`,
    subjectType: 'Release',
    subjectId: releaseId,
  });
  return prisma.release.findUniqueOrThrow({ where: { id: releaseId } });
}

export async function listDeployments(releaseId: string, actor: Actor) {
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: { projectId: true },
  });
  if (!release) throw new AppError('NOT_FOUND', 404, 'Release not found');
  await projectAccess(release.projectId, actor);
  return prisma.deployment.findMany({ where: { releaseId }, orderBy: { createdAt: 'desc' } });
}

/** Records a completed external deployment. This function never deploys software. */
export async function recordDeployment(
  releaseId: string,
  actor: Actor,
  input: RecordDeploymentInput,
) {
  const release = await prisma.release.findUnique({ where: { id: releaseId } });
  if (!release) throw new AppError('NOT_FOUND', 404, 'Release not found');
  await projectAccess(release.projectId, actor, true);
  if (input.environment === 'PRODUCTION' && (!isAdmin(actor) || !release.approvedAt)) {
    throw new AppError(
      'FORBIDDEN',
      403,
      'Administrator and release approval required for production records',
    );
  }
  if (input.environment === 'PRODUCTION' && !['APPROVED', 'DEPLOYED'].includes(release.status)) {
    throw new AppError('CONFLICT', 409, 'Release is not approved for production');
  }
  const now = new Date();
  const deployment = await prisma.deployment.create({
    data: {
      releaseId,
      environment: input.environment,
      status: input.status,
      notes: input.notes ?? null,
      deployedAt: input.status === 'SUCCEEDED' ? now : null,
      rolledBackAt: input.status === 'ROLLED_BACK' ? now : null,
    },
  });
  if (
    input.environment === 'PRODUCTION' &&
    input.status === 'SUCCEEDED' &&
    release.status === 'APPROVED'
  ) {
    await prisma.release.updateMany({
      where: { id: releaseId, status: 'APPROVED' },
      data: { status: 'DEPLOYED', deployedAt: now },
    });
  }
  if (
    input.environment === 'PRODUCTION' &&
    input.status === 'ROLLED_BACK' &&
    release.status === 'DEPLOYED'
  ) {
    await prisma.release.updateMany({
      where: { id: releaseId, status: 'DEPLOYED' },
      data: { status: 'ROLLED_BACK' },
    });
  }
  await writeAudit({
    actorId: actor.id,
    action: `deployment.${input.status.toLowerCase()}`,
    subjectType: 'Deployment',
    subjectId: deployment.id,
  });
  return deployment;
}
