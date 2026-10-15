import type { NextFunction, Request, Response } from 'express';
import type {
  ChangeProjectDocumentationStatusInput,
  CreateProjectDocumentationInput,
  ProjectDocumentation,
  UpdateProjectDocumentationInput,
} from '@somwave/shared';
import { DOCUMENTATION_STATUSES } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as service from '../services/project-documentation.service';

function routeContext(req: Request) {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const projectId = req.params.projectId;
  if (!projectId) throw new AppError('NOT_FOUND', 404, 'Project not found');
  return { projectId, actor: req.authUser };
}

function documentId(req: Request): string {
  const id = req.params.documentId;
  if (!id) throw new AppError('NOT_FOUND', 404, 'Project documentation not found');
  return id;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    const statusValue = req.query.status;
    const status =
      typeof statusValue === 'string' &&
      (DOCUMENTATION_STATUSES as readonly string[]).includes(statusValue)
        ? (statusValue as ProjectDocumentation['status'])
        : undefined;
    sendData(
      res,
      await service.listProjectDocumentation(projectId, actor, {
        search:
          typeof req.query.search === 'string' ? req.query.search.trim() || undefined : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        folder: typeof req.query.folder === 'string' ? req.query.folder : undefined,
        status,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(res, await service.getProjectDocumentation(projectId, documentId(req), actor));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(
      res,
      await service.createProjectDocumentation(
        projectId,
        actor,
        req.body as CreateProjectDocumentationInput,
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(
      res,
      await service.updateProjectDocumentation(
        projectId,
        documentId(req),
        actor,
        req.body as UpdateProjectDocumentationInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(
      res,
      await service.changeProjectDocumentationStatus(
        projectId,
        documentId(req),
        actor,
        req.body as ChangeProjectDocumentationStatusInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function setClientVisibility(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(
      res,
      await service.setClientDocumentationVisibility(
        projectId,
        documentId(req),
        actor,
        req.body.clientVisible as boolean,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function versions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(
      res,
      await service.listProjectDocumentationVersions(projectId, documentId(req), actor),
    );
  } catch (error) {
    next(error);
  }
}

export async function file(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    const version = req.query.version === undefined ? undefined : Number(req.query.version);
    if (version !== undefined && (!Number.isInteger(version) || version < 1)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid version');
    }
    const result = await service.getProjectDocumentationFile(
      projectId,
      documentId(req),
      actor,
      version,
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

export async function attachments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(res, await service.listDocumentationAttachments(projectId, documentId(req), actor));
  } catch (error) {
    next(error);
  }
}

export async function addAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(
      res,
      await service.addDocumentationAttachment(
        projectId,
        documentId(req),
        req.body.fileDocumentId,
        actor,
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function removeAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    const fileDocumentId = req.params.fileDocumentId;
    if (!fileDocumentId) throw new AppError('NOT_FOUND', 404, 'Document attachment not found');
    await service.removeDocumentationAttachment(projectId, documentId(req), fileDocumentId, actor);
    sendData(res, { success: true });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    await service.deleteProjectDocumentation(projectId, documentId(req), actor);
    sendData(res, { success: true });
  } catch (error) {
    next(error);
  }
}

function commentId(req: Request): string {
  const id = req.params.commentId;
  if (!id) throw new AppError('NOT_FOUND', 404, 'Comment not found');
  return id;
}

function linkTarget(req: Request): 'task' | 'milestone' {
  if (req.params.target === 'task' || req.params.target === 'milestone') return req.params.target;
  throw new AppError('VALIDATION_ERROR', 400, 'Link target must be a task or milestone');
}

export async function folders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(res, await service.listDocumentationFolders(projectId, actor));
  } catch (error) {
    next(error);
  }
}

export async function renameFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    const { from, to } = req.body as { from: string; to: string };
    sendData(res, await service.renameDocumentationFolder(projectId, actor, from, to));
  } catch (error) {
    next(error);
  }
}

export async function proposeTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(
      res,
      await service.proposeTasksFromDocumentation(projectId, documentId(req), actor),
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function comments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(res, await service.listDocumentationComments(projectId, documentId(req), actor));
  } catch (error) {
    next(error);
  }
}

export async function addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(
      res,
      await service.createDocumentationComment(projectId, documentId(req), actor, req.body.body),
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function editComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(
      res,
      await service.updateDocumentationComment(
        projectId,
        documentId(req),
        commentId(req),
        actor,
        req.body.body,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function removeComment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    await service.deleteDocumentationComment(projectId, documentId(req), commentId(req), actor);
    sendData(res, { success: true });
  } catch (error) {
    next(error);
  }
}

export async function links(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(res, await service.listDocumentationLinks(projectId, documentId(req), actor));
  } catch (error) {
    next(error);
  }
}

export async function addLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    sendData(
      res,
      await service.changeDocumentationLink(
        projectId,
        documentId(req),
        actor,
        linkTarget(req),
        req.body.targetId,
        true,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function removeLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, actor } = routeContext(req);
    const targetId = req.params.targetId;
    if (!targetId) throw new AppError('VALIDATION_ERROR', 400, 'Target is required');
    sendData(
      res,
      await service.changeDocumentationLink(
        projectId,
        documentId(req),
        actor,
        linkTarget(req),
        targetId,
        false,
      ),
    );
  } catch (error) {
    next(error);
  }
}
