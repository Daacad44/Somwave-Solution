import type { NextFunction, Request, Response } from 'express';
import { sendData } from '../lib/http';
import { listPortalProjects } from '../services/portal.service';

export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listPortalProjects(req.authUser?.clientId ?? null));
  } catch (err) {
    next(err);
  }
}
