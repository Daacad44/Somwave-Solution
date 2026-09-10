import type { NextFunction, Request, Response } from 'express';
import { ROLES, type CreateInvoiceInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as invoiceService from '../services/invoice.service';

function scopedClientId(req: Request): string | null {
  const roles = req.authUser?.roles ?? [];
  if (roles.includes(ROLES.CLIENT)) {
    return req.authUser?.clientId ?? null;
  }
  return null;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = req.authUser?.roles ?? [];
    if (roles.includes(ROLES.CLIENT) && !req.authUser?.clientId) {
      throw new AppError('NOT_FOUND', 404, 'Biil lama helin');
    }
    sendData(res, await invoiceService.listInvoices(scopedClientId(req)));
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
