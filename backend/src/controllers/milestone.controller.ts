// Milestones controller (I2.3, §5). Delegates to the service, returns the
// standard envelope. No Prisma here.
import type { NextFunction, Request, Response } from 'express';
import type { CreateMilestoneInput, UpdateMilestoneInput, MilestoneStatus } from '@somwave/shared';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MILESTONE_STATUSES } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as milestoneService from '../services/milestone.service';

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value: unknown): MilestoneStatus | undefined {
  return typeof value === 'string' && (MILESTONE_STATUSES as readonly string[]).includes(value)
    ? (value as MilestoneStatus)
    : undefined;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const pageSize = parsePositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE);
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const result = await milestoneService.listMilestones({
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
    const milestone = id ? await milestoneService.getMilestone(id) : null;
    if (!milestone) throw new AppError('NOT_FOUND', 404, 'Marxaladdan lama helin');
    sendData(res, milestone);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const milestone = await milestoneService.createMilestone(req.body as CreateMilestoneInput);
    sendData(res, milestone, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Marxaladdan lama helin');
    const milestone = await milestoneService.updateMilestone(id, req.body as UpdateMilestoneInput);
    sendData(res, milestone);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Marxaladdan lama helin');
    await milestoneService.deleteMilestone(id);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}
