import type { NextFunction, Request, Response } from 'express';
import type { CreateClientInput, UpdateClientInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as clientService from '../services/client.service';

export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await clientService.listClients());
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await clientService.createClient(req.body as CreateClientInput), 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Macmiilkan lama helin');
    sendData(res, await clientService.updateClient(id, req.body as UpdateClientInput));
  } catch (err) {
    next(err);
  }
}
