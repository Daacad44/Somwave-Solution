// User & role management controller (I1, §5). Parses the request, delegates to
// the service, returns the standard envelope. No Prisma here.
import type { NextFunction, Request, Response } from 'express';
import type { CreateUserInput, UpdateUserInput } from '@somwave/shared';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as userService from '../services/user.service';

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const pageSize = parsePositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const result = await userService.listUsers({ page, pageSize, search: search || undefined });
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
    const user = id ? await userService.getUser(id) : null;
    if (!user) throw new AppError('NOT_FOUND', 404, 'Isticmaalahan lama helin');
    sendData(res, user);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.createUser(req.body as CreateUserInput);
    sendData(res, user, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Isticmaalahan lama helin');
    const user = await userService.updateUser(id, req.body as UpdateUserInput);
    sendData(res, user);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Isticmaalahan lama helin');
    await userService.deactivateUser(id, req.authUser!.id);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function listRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await userService.listRoles());
  } catch (err) {
    next(err);
  }
}
