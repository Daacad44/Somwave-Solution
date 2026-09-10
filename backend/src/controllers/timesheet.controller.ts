import type { NextFunction, Request, Response } from 'express';
import type { CreateTimesheetInput, UpdateTimesheetInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as timesheetService from '../services/timesheet.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.authUser?.id;
    if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    sendData(res, await timesheetService.listTimesheets(userId));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.authUser?.id;
    if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    sendData(
      res,
      await timesheetService.createTimesheet(userId, req.body as CreateTimesheetInput),
      201,
    );
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Diiwaankan lama helin');
    const body = req.body as UpdateTimesheetInput;
    sendData(res, await timesheetService.updateTimesheetStatus(id, body.status));
  } catch (err) {
    next(err);
  }
}
