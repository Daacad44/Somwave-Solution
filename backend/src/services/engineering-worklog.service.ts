import { Prisma } from '@prisma/client';
import type {
  CorrectTaskTimeEntryInput,
  CreateEngineerProgressReportInput,
  DiscardEngineerTimerInput,
  ReviewEngineerProgressReportInput,
  StopEngineerTimerInput,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { writeAudit } from '../lib/audit';
import { emitNotification } from './notification-delivery.service';
import { logger } from '../lib/logger';

type Actor = Express.AuthUserContext;
const ENGINEER_ROLES = new Set(['ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER', 'CONTRIBUTOR']);

function isAdmin(actor: Actor): boolean {
  return actor.roles.includes('ADMIN') || actor.roles.includes('SUPER_ADMIN');
}

function parseWorkDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid work date');
  return date;
}

async function projectAccess(projectId: string, actor: Actor) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, name: true, managerId: true },
  });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: actor.id } },
    select: { role: true, removedAt: true },
  });
  const role = member && !member.removedAt ? member.role : null;
  const manage = isAdmin(actor) || project.managerId === actor.id || role === 'MANAGER';
  if (!manage && !role) throw new AppError('NOT_FOUND', 404, 'Project not found');
  return { project, manage, role };
}

async function taskAccess(taskId: string, actor: Actor) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, project: { deletedAt: null } },
    select: { id: true, title: true, projectId: true, assigneeId: true, approvalStatus: true },
  });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Task not found');
  const access = await projectAccess(task.projectId, actor);
  return { task, ...access };
}

function requireAssignedEngineer(
  task: { assigneeId: string | null; approvalStatus: string },
  role: string | null,
  actor: Actor,
) {
  if (task.assigneeId !== actor.id || !role || !ENGINEER_ROLES.has(role))
    throw new AppError('FORBIDDEN', 403, 'Only the assigned engineer may track task time');
  if (task.approvalStatus !== 'APPROVED')
    throw new AppError('CONFLICT', 409, 'Task must be approved before tracking time');
}

export async function getActiveTimer(actor: Actor) {
  return prisma.engineerTaskTimer.findFirst({
    where: { userId: actor.id, stoppedAt: null },
    include: { task: { select: { id: true, title: true, projectId: true } } },
  });
}

export async function startTaskTimer(taskId: string, actor: Actor) {
  const { task, role } = await taskAccess(taskId, actor);
  requireAssignedEngineer(task, role, actor);
  try {
    const timer = await prisma.engineerTaskTimer.create({
      data: { taskId, userId: actor.id },
      include: { task: { select: { id: true, title: true, projectId: true } } },
    });
    await writeAudit({
      actorId: actor.id,
      action: 'task.timer.start',
      subjectType: 'EngineerTaskTimer',
      subjectId: timer.id,
    });
    return timer;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new AppError('CONFLICT', 409, 'Stop your active timer before starting another');
    throw error;
  }
}

export async function stopActiveTimer(actor: Actor, input: StopEngineerTimerInput) {
  const timer = await prisma.engineerTaskTimer.findFirst({
    where: { userId: actor.id, stoppedAt: null },
    include: {
      task: {
        select: {
          id: true,
          projectId: true,
          assigneeId: true,
          approvalStatus: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!timer) throw new AppError('NOT_FOUND', 404, 'No active timer');
  if (timer.task.deletedAt) throw new AppError('CONFLICT', 409, 'Task is no longer active');
  const { role } = await projectAccess(timer.task.projectId, actor);
  requireAssignedEngineer(timer.task, role, actor);
  const now = new Date();
  const minutes = Math.ceil((now.getTime() - timer.startedAt.getTime()) / 60_000);
  if (minutes < 1 || minutes > 1440)
    throw new AppError('CONFLICT', 409, 'Timers must be stopped within 24 hours');
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const entry = await prisma.$transaction(async (tx) => {
    const claimed = await tx.engineerTaskTimer.updateMany({
      where: { id: timer.id, stoppedAt: null },
      data: { stoppedAt: now },
    });
    if (!claimed.count) throw new AppError('CONFLICT', 409, 'Timer was already stopped');
    const created = await tx.taskTimeEntry.create({
      data: { taskId: timer.taskId, userId: actor.id, minutes, date, note: input.note ?? null },
    });
    await tx.engineerTaskTimer.update({ where: { id: timer.id }, data: { entryId: created.id } });
    return created;
  });
  await writeAudit({
    actorId: actor.id,
    action: 'task.timer.stop',
    subjectType: 'TaskTimeEntry',
    subjectId: entry.id,
  });
  return { timerId: timer.id, entry };
}

/** Discards a mistaken or stale timer without fabricating a time entry. */
export async function discardActiveTimer(actor: Actor, input: DiscardEngineerTimerInput) {
  const active = await prisma.engineerTaskTimer.findFirst({
    where: { userId: actor.id, stoppedAt: null },
  });
  if (!active) throw new AppError('NOT_FOUND', 404, 'No active timer');
  const stoppedAt = new Date();
  const changed = await prisma.engineerTaskTimer.updateMany({
    where: { id: active.id, stoppedAt: null },
    data: { stoppedAt, discardReason: input.reason },
  });
  if (!changed.count) throw new AppError('CONFLICT', 409, 'Timer was already stopped');
  await writeAudit({
    actorId: actor.id,
    action: 'task.timer.discard',
    subjectType: 'EngineerTaskTimer',
    subjectId: active.id,
  });
  return { id: active.id, stoppedAt, discardReason: input.reason };
}

export async function correctTaskTimeEntry(
  taskId: string,
  entryId: string,
  actor: Actor,
  input: CorrectTaskTimeEntryInput,
) {
  const { manage } = await taskAccess(taskId, actor);
  const existing = await prisma.taskTimeEntry.findFirst({ where: { id: entryId, taskId } });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Time entry not found');
  if (!manage && existing.userId !== actor.id)
    throw new AppError(
      'FORBIDDEN',
      403,
      'Only the entry owner or project manager may correct time',
    );
  const date = parseWorkDate(input.date);
  const note = input.note === undefined ? existing.note : input.note;
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.taskTimeEntry.updateMany({
      where: { id: entryId, updatedAt: existing.updatedAt },
      data: { minutes: input.minutes, date, note },
    });
    if (!changed.count)
      throw new AppError('CONFLICT', 409, 'Time entry was changed by another user');
    await tx.taskTimeEntryRevision.create({
      data: {
        entryId,
        actorId: actor.id,
        previousMinutes: existing.minutes,
        previousDate: existing.date,
        previousNote: existing.note,
        minutes: input.minutes,
        date,
        note,
        reason: input.reason,
      },
    });
    return tx.taskTimeEntry.findUniqueOrThrow({ where: { id: entryId } });
  });
  await writeAudit({
    actorId: actor.id,
    action: 'task.hours.correct',
    subjectType: 'TaskTimeEntry',
    subjectId: entryId,
    before: { minutes: existing.minutes, date: existing.date.toISOString().slice(0, 10) },
    after: { minutes: result.minutes, date: result.date.toISOString().slice(0, 10) },
  });
  return result;
}

export async function listTaskTimeEntryRevisions(taskId: string, entryId: string, actor: Actor) {
  const { manage } = await taskAccess(taskId, actor);
  const entry = await prisma.taskTimeEntry.findFirst({
    where: { id: entryId, taskId },
    select: { userId: true },
  });
  if (!entry) throw new AppError('NOT_FOUND', 404, 'Time entry not found');
  if (!manage && entry.userId !== actor.id)
    throw new AppError(
      'FORBIDDEN',
      403,
      'Only the entry owner or project manager may view corrections',
    );
  return prisma.taskTimeEntryRevision.findMany({
    where: { entryId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listProgressReports(projectId: string, actor: Actor) {
  const { manage } = await projectAccess(projectId, actor);
  return prisma.engineerProgressReport.findMany({
    where: { projectId, ...(manage ? {} : { authorId: actor.id }) },
    include: {
      author: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { periodStart: 'desc' },
    take: 100,
  });
}

export async function createProgressReport(
  projectId: string,
  actor: Actor,
  input: CreateEngineerProgressReportInput,
) {
  const { project, role } = await projectAccess(projectId, actor);
  if (!role || !ENGINEER_ROLES.has(role))
    throw new AppError('FORBIDDEN', 403, 'Active engineering membership required');
  const periodStart = parseWorkDate(input.periodStart);
  const today = new Date();
  if (periodStart.getTime() > today.getTime())
    throw new AppError('VALIDATION_ERROR', 400, 'Report date cannot be in the future');
  if (input.period === 'WEEKLY' && periodStart.getUTCDay() !== 1)
    throw new AppError('VALIDATION_ERROR', 400, 'Weekly reports must start on Monday');
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + (input.period === 'DAILY' ? 1 : 7));
  const hoursWorkedMinutes =
    (
      await prisma.taskTimeEntry.aggregate({
        where: { userId: actor.id, task: { projectId }, date: { gte: periodStart, lt: periodEnd } },
        _sum: { minutes: true },
      })
    )._sum.minutes ?? 0;
  try {
    const report = await prisma.engineerProgressReport.create({
      data: {
        projectId,
        authorId: actor.id,
        period: input.period,
        periodStart,
        completedWork: input.completedWork,
        inProgressWork: input.inProgressWork ?? null,
        blockers: input.blockers ?? null,
        nextPlannedWork: input.nextPlannedWork ?? null,
        milestoneProgress: input.milestoneProgress ?? null,
        priorities: input.priorities ?? null,
        hoursWorkedMinutes,
        reportedHoursMinutes: input.reportedHoursMinutes ?? null,
      },
    });
    await writeAudit({
      actorId: actor.id,
      action: 'progressReport.submit',
      subjectType: 'EngineerProgressReport',
      subjectId: report.id,
    });
    if (project.managerId && project.managerId !== actor.id) {
      try {
        await emitNotification({
          userId: project.managerId,
          title: 'Engineer progress report submitted',
          body: `A ${input.period.toLowerCase()} progress report was submitted for ${project.name}.`,
          eventKey: 'progress.report',
          dedupeKey: `progress-report:${report.id}:manager`,
        });
      } catch (error) {
        logger.error({ err: error }, 'Progress report notification failed');
      }
    }
    return report;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new AppError('CONFLICT', 409, 'A report for this period has already been submitted');
    throw error;
  }
}

export async function reviewProgressReport(
  reportId: string,
  actor: Actor,
  input: ReviewEngineerProgressReportInput,
) {
  const report = await prisma.engineerProgressReport.findUnique({ where: { id: reportId } });
  if (!report) throw new AppError('NOT_FOUND', 404, 'Progress report not found');
  const { manage } = await projectAccess(report.projectId, actor);
  if (!manage) throw new AppError('FORBIDDEN', 403, 'Project manager access required');
  if (report.authorId === actor.id)
    throw new AppError('FORBIDDEN', 403, 'Authors cannot review their own reports');
  const updated = await prisma.engineerProgressReport.update({
    where: { id: reportId },
    data: {
      status: input.status,
      reviewNote: input.note,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: `progressReport.${input.status.toLowerCase()}`,
    subjectType: 'EngineerProgressReport',
    subjectId: reportId,
    before: { status: report.status, reviewedById: report.reviewedById },
    after: { status: updated.status, reviewedById: actor.id },
  });
  try {
    await emitNotification({
      userId: report.authorId,
      title:
        input.status === 'REVIEWED'
          ? 'Progress report reviewed'
          : 'Progress report clarification requested',
      body: input.note,
      eventKey: 'progress.report',
      dedupeKey: `progress-report:${reportId}:review:${updated.updatedAt.toISOString()}`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Progress report review notification failed');
  }
  return updated;
}
