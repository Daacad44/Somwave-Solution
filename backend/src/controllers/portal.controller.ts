import type { NextFunction, Request, Response } from 'express';
import { AppError, sendData } from '../lib/http';
import {
  getPortalProject,
  listPortalMilestones,
  listPortalProjects,
} from '../services/portal.service';

export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listPortalProjects(req.authUser?.clientId ?? null));
  } catch (err) {
    next(err);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Mashruuc lama helin');
    sendData(res, await getPortalProject(req.authUser?.clientId ?? null, id));
  } catch (err) {
    next(err);
  }
}

export async function listMilestones(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await listPortalMilestones(req.authUser?.clientId ?? null));
  } catch (err) {
    next(err);
  }
}
