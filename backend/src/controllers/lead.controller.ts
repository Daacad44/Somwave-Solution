import type { NextFunction, Request, Response } from 'express';
import type { UpdateInquiryInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import { listInquiries, updateInquiryStatus } from '../services/inquiry.service';

export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listInquiries());
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Codsigan lama helin');
    const body = req.body as UpdateInquiryInput;
    sendData(res, await updateInquiryStatus(id, body.status));
  } catch (err) {
    next(err);
  }
}
