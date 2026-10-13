import type { NextFunction, Request, Response } from 'express';
import type {
  CorrectTaskTimeEntryInput,
  CreateEngineerProgressReportInput,
  DiscardEngineerTimerInput,
  ReviewEngineerProgressReportInput,
  StopEngineerTimerInput,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as worklog from '../services/engineering-worklog.service';

function actor(req: Request): Express.AuthUserContext {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return req.authUser;
}

function param(req: Request, key: string): string {
  const value = req.params[key];
  if (!value) throw new AppError('VALIDATION_ERROR', 400, `${key} is required`);
  return value;
}

function handle(action: (req: Request) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendData(res, await action(req), status);
    } catch (error) {
      next(error);
    }
  };
}

export const activeTimer = handle((req) => worklog.getActiveTimer(actor(req)));
export const startTimer = handle(
  (req) => worklog.startTaskTimer(param(req, 'taskId'), actor(req)),
  201,
);
export const stopTimer = handle((req) =>
  worklog.stopActiveTimer(actor(req), req.body as StopEngineerTimerInput),
);
export const discardTimer = handle((req) =>
  worklog.discardActiveTimer(actor(req), req.body as DiscardEngineerTimerInput),
);
export const correctHours = handle((req) =>
  worklog.correctTaskTimeEntry(
    param(req, 'taskId'),
    param(req, 'entryId'),
    actor(req),
    req.body as CorrectTaskTimeEntryInput,
  ),
);
export const hourRevisions = handle((req) =>
  worklog.listTaskTimeEntryRevisions(param(req, 'taskId'), param(req, 'entryId'), actor(req)),
);
export const reports = handle((req) =>
  worklog.listProgressReports(param(req, 'projectId'), actor(req)),
);
export const createReport = handle(
  (req) =>
    worklog.createProgressReport(
      param(req, 'projectId'),
      actor(req),
      req.body as CreateEngineerProgressReportInput,
    ),
  201,
);
export const reviewReport = handle((req) =>
  worklog.reviewProgressReport(
    param(req, 'reportId'),
    actor(req),
    req.body as ReviewEngineerProgressReportInput,
  ),
);
