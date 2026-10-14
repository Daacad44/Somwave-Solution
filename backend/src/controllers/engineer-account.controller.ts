import type { NextFunction, Request, Response } from 'express';
import type {
  ActivateEngineerInvitationInput,
  CreateEngineerAccountInput,
  UpdateEngineerAccountInput,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as accounts from '../services/engineer-account.service';

function actor(req: Request): Express.AuthUserContext {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return req.authUser;
}

function userId(req: Request): string {
  if (!req.params.userId) throw new AppError('VALIDATION_ERROR', 400, 'Engineer ID is required');
  return req.params.userId;
}

function handle(fn: (req: Request) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendData(res, await fn(req), status);
    } catch (error) {
      next(error);
    }
  };
}

export const list = handle((req) => accounts.listEngineerAccounts(actor(req)));
export const emailReadiness = handle((req) =>
  Promise.resolve(accounts.engineerEmailReadiness(actor(req))),
);
export const detail = handle((req) => accounts.getEngineerAccount(actor(req), userId(req)));
export const create = handle(
  (req) => accounts.createEngineerAccount(actor(req), req.body as CreateEngineerAccountInput),
  201,
);
export const update = handle((req) =>
  accounts.updateEngineerAccount(actor(req), userId(req), req.body as UpdateEngineerAccountInput),
);
export const resend = handle((req) => accounts.resendEngineerInvitation(actor(req), userId(req)));
export const cancel = handle((req) => accounts.cancelEngineerInvitation(actor(req), userId(req)));
export const suspend = handle((req) =>
  accounts.setEngineerAccountSuspended(actor(req), userId(req), true),
);
export const reactivate = handle((req) =>
  accounts.setEngineerAccountSuspended(actor(req), userId(req), false),
);
export const activity = handle((req) =>
  accounts.listEngineerAccountActivity(actor(req), userId(req)),
);
export const verify = handle((req) =>
  accounts.verifyEngineerInvitation((req.body as { token: string }).token),
);
export const requestResend = handle((req) =>
  accounts.requestEngineerVerificationResend((req.body as { email: string }).email),
);
export const activate = handle((req) =>
  accounts.activateEngineerInvitation(req.body as ActivateEngineerInvitationInput),
);
