import type { NextFunction, Request, Response } from 'express';
import { holdsPermission, PERMISSIONS, type UpdateInquiryInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import {
  convertInquiryToClient,
  listInquiries,
  updateInquiryStatus,
} from '../services/inquiry.service';

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

export async function convert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.authUser;
    if (!user) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }
    if (!holdsPermission(user, PERMISSIONS.CLIENTS_CREATE)) {
      throw new AppError('FORBIDDEN', 403, 'Insufficient permissions');
    }
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Codsigan lama helin');
    const result = await convertInquiryToClient(id, user.id);
    sendData(res, result, result.created ? 201 : 200);
  } catch (err) {
    next(err);
  }
}
