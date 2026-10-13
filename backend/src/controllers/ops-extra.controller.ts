import type { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ROLES,
  type CheckInInput,
  type CreateDocumentInput,
  type CreateEmployeeInput,
  type CreateLeaveRequestInput,
  type CreateMediaAssetInput,
  type UpdateEmployeeInput,
  type UpdateLeaveRequestInput,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as hr from '../services/hr.service';
import * as documents from '../services/document.service';
import * as media from '../services/media.service';
import * as system from '../services/system.service';

function actorId(req: Request): string {
  if (!req.authUser?.id) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return req.authUser.id;
}

function paramId(req: Request): string {
  const id = req.params.id;
  if (!id) throw new AppError('NOT_FOUND', 404, 'Not found');
  return id;
}

function pageParam(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid pagination parameter');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > max)
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid pagination parameter');
  return parsed;
}

function scopedClient(req: Request): string | null {
  const roles = req.authUser?.roles ?? [];
  if (roles.includes(ROLES.CLIENT)) {
    if (!req.authUser?.clientId) throw new AppError('NOT_FOUND', 404, 'Document not found');
    return req.authUser.clientId;
  }
  return null;
}

export async function listEmployees(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await hr.listEmployees());
  } catch (err) {
    next(err);
  }
}

export async function listEmployeeCandidates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await hr.listEmployeeCandidates());
  } catch (err) {
    next(err);
  }
}

export async function createEmployee(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await hr.createEmployee(req.body as CreateEmployeeInput, actorId(req)), 201);
  } catch (err) {
    next(err);
  }
}

export async function updateEmployee(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(
      res,
      await hr.updateEmployee(paramId(req), req.body as UpdateEmployeeInput, actorId(req)),
    );
  } catch (err) {
    next(err);
  }
}

export async function listAttendance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await hr.listAttendance());
  } catch (err) {
    next(err);
  }
}

export async function checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { employeeId } = req.body as CheckInInput;
    sendData(res, await hr.checkIn(employeeId), 201);
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { employeeId } = req.body as CheckInInput;
    sendData(res, await hr.checkOut(employeeId));
  } catch (err) {
    next(err);
  }
}

export async function listLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await hr.listLeaveRequests());
  } catch (err) {
    next(err);
  }
}

export async function createLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await hr.createLeaveRequest(req.body as CreateLeaveRequestInput), 201);
  } catch (err) {
    next(err);
  }
}

export async function updateLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(
      res,
      await hr.updateLeaveRequest(paramId(req), req.body as UpdateLeaveRequestInput, actorId(req)),
    );
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
    const page = pageParam(req.query.page, DEFAULT_PAGE, 1_000_000);
    const pageSize = pageParam(req.query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const search = req.query.search;
    if (search !== undefined && (typeof search !== 'string' || search.length > 200))
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid search');
    const result = await documents.listDocuments(scopedClient(req), {
      page,
      pageSize,
      search: search?.trim() || undefined,
    });
    sendData(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
}

export async function createDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(
      res,
      await documents.createDocument(
        req.body as CreateDocumentInput,
        actorId(req),
        scopedClient(req),
      ),
      201,
    );
  } catch (err) {
    next(err);
  }
}

export async function downloadDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const file = await documents.getDocumentFile(paramId(req), scopedClient(req));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.bytes);
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await documents.deleteDocument(paramId(req), actorId(req), scopedClient(req));
    sendData(res, { ok: true });
  } catch (err) {
    next(err);
  }
}

export async function listMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await media.listMedia());
  } catch (err) {
    next(err);
  }
}

export async function createMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await media.createMedia(req.body as CreateMediaAssetInput, actorId(req)), 201);
  } catch (err) {
    next(err);
  }
}

export async function downloadMedia(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const file = await media.getMediaFile(paramId(req));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    res.send(file.bytes);
  } catch (err) {
    next(err);
  }
}

export async function deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await media.deleteMedia(paramId(req));
    sendData(res, { ok: true });
  } catch (err) {
    next(err);
  }
}

export async function listAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await system.listAuditLogs());
  } catch (err) {
    next(err);
  }
}

export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await system.listNotifications(actorId(req)));
  } catch (err) {
    next(err);
  }
}

export async function readNotification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await system.markNotificationRead(paramId(req), actorId(req)));
  } catch (err) {
    next(err);
  }
}
