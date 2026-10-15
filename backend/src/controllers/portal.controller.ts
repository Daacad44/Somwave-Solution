import type { NextFunction, Request, Response } from 'express';
import { AppError, sendData } from '../lib/http';
import {
  getPortalProject,
  listPortalMilestones,
  listPortalProjects,
  listPortalDocuments,
  getPortalDocumentFile,
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

export async function listDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const projectId = req.params.id;
    if (!projectId) throw new AppError('NOT_FOUND', 404, 'Project not found');
    sendData(res, await listPortalDocuments(req.authUser?.clientId ?? null, projectId));
  } catch (error) {
    next(error);
  }
}

export async function downloadDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const projectId = req.params.id;
    const documentId = req.params.documentId;
    if (!projectId || !documentId) throw new AppError('NOT_FOUND', 404, 'Document not found');
    const result = await getPortalDocumentFile(
      req.authUser?.clientId ?? null,
      projectId,
      documentId,
    );
    const safeName = result.fileName.replace(/[\r\n"\\]/g, '_');
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(result.bytes);
  } catch (error) {
    next(error);
  }
}
