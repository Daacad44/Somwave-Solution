import type { NextFunction, Request, Response } from 'express';
import type {
  CreateBugReportInput,
  CreateMaintenanceRequestInput,
  CreateManagedSystemInput,
  CreateReleaseInput,
  CreateSystemUpdateInput,
  UpdateBugReportInput,
  UpdateMaintenanceRequestInput,
  TransitionSystemUpdateInput,
  TransitionReleaseInput,
  RecordDeploymentInput,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as operations from '../services/engineering-operations.service';

function actor(req: Request): Express.AuthUserContext {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return req.authUser;
}

function param(req: Request, key: string): string {
  const value = req.params[key];
  if (!value) throw new AppError('VALIDATION_ERROR', 400, `${key} is required`);
  return value;
}

type Action = (req: Request) => Promise<unknown>;
function handle(action: Action, status = 200) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendData(res, await action(req), status);
    } catch (error) {
      next(error);
    }
  };
}

export const listSystems = handle((req) =>
  operations.listSystems(param(req, 'projectId'), actor(req)),
);
export const listSystemHealth = handle((req) =>
  operations.listSystemHealth(param(req, 'systemId'), actor(req)),
);
export const createSystem = handle(
  (req) =>
    operations.createSystem(
      param(req, 'projectId'),
      actor(req),
      req.body as CreateManagedSystemInput,
    ),
  201,
);
export const listUpdates = handle((req) =>
  operations.listUpdates(param(req, 'systemId'), actor(req)),
);
export const createUpdate = handle(
  (req) =>
    operations.createUpdate(
      param(req, 'systemId'),
      actor(req),
      req.body as CreateSystemUpdateInput,
    ),
  201,
);
export const transitionUpdate = handle((req) =>
  operations.transitionUpdate(
    param(req, 'updateId'),
    actor(req),
    req.body as TransitionSystemUpdateInput,
  ),
);
export const approveUpdateProduction = handle((req) =>
  operations.approveUpdateProduction(param(req, 'updateId'), actor(req)),
);
export const listBugs = handle((req) => operations.listBugs(param(req, 'systemId'), actor(req)));
export const createBug = handle(
  (req) =>
    operations.createBug(param(req, 'systemId'), actor(req), req.body as CreateBugReportInput),
  201,
);
export const updateBug = handle((req) =>
  operations.updateBug(param(req, 'bugId'), actor(req), req.body as UpdateBugReportInput),
);
export const listMaintenance = handle((req) =>
  operations.listMaintenance(param(req, 'systemId'), actor(req)),
);
export const createMaintenance = handle(
  (req) =>
    operations.createMaintenance(
      param(req, 'systemId'),
      actor(req),
      req.body as CreateMaintenanceRequestInput,
    ),
  201,
);
export const updateMaintenance = handle((req) =>
  operations.updateMaintenance(
    param(req, 'requestId'),
    actor(req),
    req.body as UpdateMaintenanceRequestInput,
  ),
);
export const listReleases = handle((req) =>
  operations.listReleases(param(req, 'systemId'), actor(req)),
);
export const createRelease = handle(
  (req) =>
    operations.createRelease(param(req, 'systemId'), actor(req), req.body as CreateReleaseInput),
  201,
);
export const addReleaseTask = handle(
  (req) =>
    operations.changeReleaseTask(
      param(req, 'releaseId'),
      req.body.taskId as string,
      actor(req),
      true,
    ),
  201,
);
export const removeReleaseTask = handle((req) =>
  operations.changeReleaseTask(param(req, 'releaseId'), param(req, 'taskId'), actor(req), false),
);
export const listProjectPullRequests = handle((req) =>
  operations.listProjectPullRequests(param(req, 'projectId'), actor(req)),
);
export const addReleasePullRequest = handle(
  (req) =>
    operations.changeReleasePullRequest(
      param(req, 'releaseId'),
      req.body.linkId as string,
      actor(req),
      true,
    ),
  201,
);
export const removeReleasePullRequest = handle((req) =>
  operations.changeReleasePullRequest(
    param(req, 'releaseId'),
    param(req, 'linkId'),
    actor(req),
    false,
  ),
);
export const approveRelease = handle((req) =>
  operations.approveRelease(param(req, 'releaseId'), actor(req)),
);
export const transitionRelease = handle((req) =>
  operations.transitionRelease(
    param(req, 'releaseId'),
    actor(req),
    req.body as TransitionReleaseInput,
  ),
);
export const listDeployments = handle((req) =>
  operations.listDeployments(param(req, 'releaseId'), actor(req)),
);
export const recordDeployment = handle(
  (req) =>
    operations.recordDeployment(
      param(req, 'releaseId'),
      actor(req),
      req.body as RecordDeploymentInput,
    ),
  201,
);
