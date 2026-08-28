// CMS controller (W4, §5, §9). Authenticated content management for the website.
// Delegates to services and returns the standard envelope. No Prisma here.
import type { NextFunction, Request, Response } from 'express';
import type { CreateServiceInput, UpdateServiceInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as serviceService from '../services/service.service';

export async function listServices(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await serviceService.listAllServices());
  } catch (err) {
    next(err);
  }
}

export async function createService(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const service = await serviceService.createService(req.body as CreateServiceInput);
    sendData(res, service, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateService(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Adeegan lama helin');
    const service = await serviceService.updateService(id, req.body as UpdateServiceInput);
    sendData(res, service);
  } catch (err) {
    next(err);
  }
}

export async function deleteService(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Adeegan lama helin');
    await serviceService.deleteService(id);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}
