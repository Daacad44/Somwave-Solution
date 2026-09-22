import type { NextFunction, Request, Response } from 'express';
import { ROLES, type CreateInvoiceInput, type InvoiceDetail } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import {
  idempotencyCacheKey,
  readIdempotencyKey,
  replayIdempotent,
  storeIdempotent,
} from '../lib/idempotency';
import * as invoiceService from '../services/invoice.service';

function scopedClientId(req: Request): string | null {
  const roles = req.authUser?.roles ?? [];
  if (roles.includes(ROLES.CLIENT)) {
    return req.authUser?.clientId ?? null;
  }
  return null;
}

function requireScopedClient(req: Request): string | null {
  const roles = req.authUser?.roles ?? [];
  if (roles.includes(ROLES.CLIENT) && !req.authUser?.clientId) {
    throw new AppError('NOT_FOUND', 404, 'Biil lama helin');
  }
  return scopedClientId(req);
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await invoiceService.listInvoices(requireScopedClient(req)));
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');
    sendData(res, await invoiceService.getInvoice(id, requireScopedClient(req)));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await invoiceService.createInvoice(req.body as CreateInvoiceInput), 201);
  } catch (err) {
    next(err);
  }
}

export async function send(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');
    const actorId = req.authUser?.id;
    if (!actorId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');

    const key = readIdempotencyKey(req.header('Idempotency-Key'));
    const cacheKey = idempotencyCacheKey(`invoice-send:${id}`, actorId, key);
    const replay = await replayIdempotent<InvoiceDetail>(cacheKey);
    if (replay) {
      sendData(res, replay);
      return;
    }

    const data = await invoiceService.sendInvoice(id, requireScopedClient(req));
    await storeIdempotent(cacheKey, data);
    sendData(res, data);
  } catch (err) {
    next(err);
  }
}

export async function voidInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');
    sendData(res, await invoiceService.voidInvoice(id, requireScopedClient(req)));
  } catch (err) {
    next(err);
  }
}
