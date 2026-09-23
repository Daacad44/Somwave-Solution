import type { NextFunction, Request, Response } from 'express';
import { ROLES, type ChargeEvcPaymentInput, type RecordPaymentInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import { readIdempotencyKey } from '../lib/idempotency';
import * as paymentService from '../services/payment.service';

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
    throw new AppError('NOT_FOUND', 404, 'Biilkan lama helin');
  }
  return scopedClientId(req);
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actorId = req.authUser?.id;
    if (!actorId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const roles = req.authUser?.roles ?? [];
    if (roles.includes(ROLES.CLIENT)) {
      throw new AppError('FORBIDDEN', 403, 'Isticmaal EVC Plus portal-ka');
    }
    const key = readIdempotencyKey(req.header('Idempotency-Key'));
    const body = req.body as RecordPaymentInput;
    sendData(
      res,
      await paymentService.recordPayment({
        ...body,
        actorId,
        idempotencyKey: key,
        clientId: requireScopedClient(req),
      }),
      201,
    );
  } catch (err) {
    next(err);
  }
}

export async function chargeEvc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actorId = req.authUser?.id;
    if (!actorId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const key = readIdempotencyKey(req.header('Idempotency-Key'));
    const body = req.body as ChargeEvcPaymentInput;
    sendData(
      res,
      await paymentService.chargeEvcPlus({
        ...body,
        actorId,
        idempotencyKey: key,
        clientId: requireScopedClient(req),
      }),
      201,
    );
  } catch (err) {
    next(err);
  }
}

export async function listForInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const invoiceId = typeof req.query.invoiceId === 'string' ? req.query.invoiceId : '';
    if (!invoiceId) throw new AppError('VALIDATION_ERROR', 400, 'invoiceId waa waajib');
    sendData(res, await paymentService.listPayments(invoiceId, requireScopedClient(req)));
  } catch (err) {
    next(err);
  }
}
