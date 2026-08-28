// Projects controller (I2.1, §5). Parses the request, delegates to the service,
// returns the standard envelope. No Prisma here.
import type { NextFunction, Request, Response } from 'express';
import type { CreateProjectInput, UpdateProjectInput, ProjectStatus } from '@somwave/shared';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, PROJECT_STATUSES } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as projectService from '../services/project.service';

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value: unknown): ProjectStatus | undefined {
  return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value)
    ? (value as ProjectStatus)
    : undefined;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const pageSize = parsePositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const result = await projectService.listProjects({
      page,
      pageSize,
      search: search || undefined,
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
    const project = id ? await projectService.getProject(id) : null;
    if (!project) throw new AppError('NOT_FOUND', 404, 'Mashruucan lama helin');
    sendData(res, project);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await projectService.createProject(req.body as CreateProjectInput);
    sendData(res, project, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Mashruucan lama helin');
    const project = await projectService.updateProject(id, req.body as UpdateProjectInput);
    sendData(res, project);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Mashruucan lama helin');
    await projectService.deleteProject(id);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}
