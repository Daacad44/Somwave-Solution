// Role & permission management controller (I1.2, §5). Delegates to the service,
// returns the standard envelope. No Prisma here.
import type { NextFunction, Request, Response } from 'express';
import type { UpdateRolePermissionsInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as roleService from '../services/role.service';

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const role = id ? await roleService.getRole(id) : null;
    if (!role) throw new AppError('NOT_FOUND', 404, 'Doorkan lama helin');
    sendData(res, role);
  } catch (err) {
    next(err);
  }
}

export async function listPermissions(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await roleService.listPermissions());
  } catch (err) {
    next(err);
  }
}

export async function setPermissions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Doorkan lama helin');
    const { permissionKeys } = req.body as UpdateRolePermissionsInput;
    sendData(res, await roleService.setRolePermissions(id, permissionKeys));
  } catch (err) {
    next(err);
  }
}
