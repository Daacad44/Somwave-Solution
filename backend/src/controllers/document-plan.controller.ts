import type { NextFunction, Request, Response } from 'express';
import type { CreateDocumentPlanInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as service from '../services/document-plan.service';

function context(req: Request) {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const { projectId, documentId } = req.params;
  if (!projectId || !documentId)
    throw new AppError('NOT_FOUND', 404, 'Project documentation not found');
  return { projectId, documentId, actor: req.authUser };
}

function planId(req: Request) {
  if (!req.params.planId) throw new AppError('NOT_FOUND', 404, 'Document plan not found');
  return req.params.planId;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, documentId, actor } = context(req);
    sendData(res, await service.listDocumentPlans(projectId, documentId, actor));
  } catch (error) {
    next(error);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, documentId, actor } = context(req);
    sendData(res, await service.getDocumentPlan(projectId, documentId, planId(req), actor));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, documentId, actor } = context(req);
    sendData(
      res,
      await service.createDocumentPlan(
        projectId,
        documentId,
        actor,
        req.body as CreateDocumentPlanInput,
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function activate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, documentId, actor } = context(req);
    sendData(
      res,
      await service.reviewDocumentPlan(
        projectId,
        documentId,
        planId(req),
        actor,
        'activate',
        req.body.note,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, documentId, actor } = context(req);
    sendData(
      res,
      await service.reviewDocumentPlan(
        projectId,
        documentId,
        planId(req),
        actor,
        'reject',
        req.body.note,
      ),
    );
  } catch (error) {
    next(error);
  }
}
