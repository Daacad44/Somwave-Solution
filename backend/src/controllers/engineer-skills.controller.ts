import type { NextFunction, Request, Response } from 'express';
import type {
  ReplaceEngineerSkillsInput,
  ReplaceEngineerWeeklyScheduleInput,
} from '@somwave/shared';
import { engineerSkillSearchSchema } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as service from '../services/engineer-skills.service';

function actor(req: Request): Express.AuthUserContext {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return req.authUser;
}

function userId(req: Request): string {
  if (!req.params.userId) throw new AppError('NOT_FOUND', 404, 'Engineer not found');
  return req.params.userId;
}

export async function mySkills(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const self = actor(req);
    sendData(res, await service.getEngineerSkills(self.id, self, true));
  } catch (error) {
    next(error);
  }
}
export async function putMySkills(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(
      res,
      await service.replaceEngineerSkills(actor(req), req.body as ReplaceEngineerSkillsInput),
    );
  } catch (error) {
    next(error);
  }
}
export async function mySchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const self = actor(req);
    sendData(res, await service.getEngineerWeeklySchedule(self.id, self, true));
  } catch (error) {
    next(error);
  }
}
export async function putMySchedule(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(
      res,
      await service.replaceEngineerWeeklySchedule(
        actor(req),
        req.body as ReplaceEngineerWeeklyScheduleInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}
export async function engineerSkills(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await service.getEngineerSkills(userId(req), actor(req)));
  } catch (error) {
    next(error);
  }
}
export async function engineerSchedule(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await service.getEngineerWeeklySchedule(userId(req), actor(req)));
  } catch (error) {
    next(error);
  }
}
export async function skillSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = engineerSkillSearchSchema.safeParse(req.query);
    if (!result.success)
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid skill filters', result.error.flatten());
    sendData(res, await service.searchEngineersBySkill(actor(req), result.data));
  } catch (error) {
    next(error);
  }
}
