// Tasks controller (I2.2, §5). Delegates to the service, returns the standard
// envelope. No Prisma here.
import type { NextFunction, Request, Response } from 'express';
import type { CreateTaskInput, UpdateTaskInput, TaskStatus } from '@somwave/shared';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, TASK_STATUSES } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as taskService from '../services/task.service';

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value: unknown): TaskStatus | undefined {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value)
    ? (value as TaskStatus)
    : undefined;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const pageSize = parsePositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE);
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const result = await taskService.listTasks({
      page,
      pageSize,
      projectId: projectId || undefined,
      status: parseStatus(req.query.status),
    });
    sendData(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const task = id ? await taskService.getTask(id) : null;
    if (!task) throw new AppError('NOT_FOUND', 404, 'Hawshan lama helin');
    sendData(res, task);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await taskService.createTask(req.body as CreateTaskInput);
    sendData(res, task, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Hawshan lama helin');
    const task = await taskService.updateTask(id, req.body as UpdateTaskInput);
    sendData(res, task);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Hawshan lama helin');
    await taskService.deleteTask(id);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}
