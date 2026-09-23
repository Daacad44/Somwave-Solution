import type { NextFunction, Request, Response } from 'express';
import type { UpdateJobApplicationInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import { listApplications, updateApplicationStatus } from '../services/job.service';

export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listApplications());
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Codsigan lama helin');
    const body = req.body as UpdateJobApplicationInput;
    sendData(res, await updateApplicationStatus(id, body.status));
  } catch (err) {
    next(err);
  }
}
