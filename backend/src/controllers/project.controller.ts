// Projects controller (I2.1, §5). Parses the request, delegates to the service,
// returns the standard envelope. No Prisma here.
import type { NextFunction, Request, Response } from 'express';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  UpdateProjectHealthNoteInput,
  ProjectStatus,
  ProjectHealth,
  TaskPriority,
  CreateProjectExpenseInput,
  ReviseProjectBudgetInput,
} from '@somwave/shared';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  PROJECT_STATUSES,
  PROJECT_HEALTH,
  TASK_PRIORITIES,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as projectService from '../services/project.service';
import * as projectFinance from '../services/project-finance.service';
import { getProjectActivity } from '../services/project-activity.service';

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value: unknown): ProjectStatus | undefined {
  return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value)
    ? (value as ProjectStatus)
    : undefined;
}

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function queryDate(value: unknown): string | undefined {
  const text = queryString(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text))
    ? text
    : undefined;
}

export async function portfolio(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const priority = queryString(req.query.priority);
    const health = queryString(req.query.health);
    const sortBy = queryString(req.query.sortBy);
    const sortDirection = queryString(req.query.sortDirection);
    sendData(
      res,
      await projectService.getProjectPortfolio({
        actor: req.authUser,
        page: parsePositiveInt(req.query.page, DEFAULT_PAGE),
        pageSize: parsePositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE),
        search: queryString(req.query.search),
        status: parseStatus(req.query.status),
        priority:
          priority && (TASK_PRIORITIES as readonly string[]).includes(priority)
            ? (priority as TaskPriority)
            : undefined,
        managerId: queryString(req.query.managerId),
        engineerId: queryString(req.query.engineerId),
        clientId: queryString(req.query.clientId),
        health:
          health && (PROJECT_HEALTH as readonly string[]).includes(health)
            ? (health as ProjectHealth)
            : undefined,
        dueFrom: queryDate(req.query.dueFrom),
        dueTo: queryDate(req.query.dueTo),
        createdFrom: queryDate(req.query.createdFrom),
        createdTo: queryDate(req.query.createdTo),
        sortBy:
          sortBy &&
          ['name', 'dueDate', 'createdAt', 'priority', 'health', 'progress'].includes(sortBy)
            ? (sortBy as 'name' | 'dueDate' | 'createdAt' | 'priority' | 'health' | 'progress')
            : undefined,
        sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function finance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.authUser || !req.params.id)
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    sendData(res, await projectFinance.getProjectFinance(req.params.id, req.authUser));
  } catch (err) {
    next(err);
  }
}
export async function activity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.authUser || !req.params.id)
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    sendData(res, await getProjectActivity(req.params.id, req.authUser));
  } catch (err) {
    next(err);
  }
}
export async function createExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.authUser || !req.params.id)
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    sendData(
      res,
      await projectFinance.createProjectExpense(
        req.params.id,
        req.authUser,
        req.body as CreateProjectExpenseInput,
      ),
      201,
    );
  } catch (err) {
    next(err);
  }
}
export async function removeExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.authUser || !req.params.id || !req.params.expenseId)
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    sendData(
      res,
      await projectFinance.removeProjectExpense(req.params.id, req.params.expenseId, req.authUser),
    );
  } catch (err) {
    next(err);
  }
}
export async function reviseBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.authUser || !req.params.id)
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    sendData(
      res,
      await projectFinance.reviseProjectBudget(
        req.params.id,
        req.authUser,
        req.body as ReviseProjectBudgetInput,
      ),
      201,
    );
  } catch (err) {
    next(err);
  }
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
      actor: req.authUser,
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
    const project = id ? await projectService.getProject(id, req.authUser) : null;
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
    sendData(res, project);
  } catch (err) {
    next(err);
  }
}

export async function workspace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const project = id
      ? await projectService.getProjectWorkspace(id, { actor: req.authUser })
      : null;
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
    sendData(res, project);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await projectService.createProject(
      req.body as CreateProjectInput,
      req.authUser,
    );
    sendData(res, project, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Project not found');
    const project = await projectService.updateProject(
      id,
      req.body as UpdateProjectInput,
      req.authUser,
    );
    sendData(res, project);
  } catch (err) {
    next(err);
  }
}

export async function updateHealthNote(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Project not found');
    if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    sendData(
      res,
      await projectService.updateProjectHealthNote(
        id,
        req.body as UpdateProjectHealthNoteInput,
        req.authUser,
      ),
    );
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Project not found');
    await projectService.deleteProject(id, req.authUser);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}
