import type { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type CreateClientInput,
  type UpdateClientInput,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as clientService from '../services/client.service';

function pageParam(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid pagination parameter');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > max)
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid pagination parameter');
  return parsed;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = pageParam(req.query.page, DEFAULT_PAGE, 1_000_000);
    const pageSize = pageParam(req.query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const search = req.query.search;
    if (search !== undefined && (typeof search !== 'string' || search.length > 200))
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid search');
    const result = await clientService.listClients({
      page,
      pageSize,
      search: search?.trim() || undefined,
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

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await clientService.createClient(req.body as CreateClientInput), 201);
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Macmiilkan lama helin');
    sendData(res, await clientService.getClientProfile(id));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Client not found');
    sendData(res, await clientService.updateClient(id, req.body as UpdateClientInput));
  } catch (err) {
    next(err);
  }
}
