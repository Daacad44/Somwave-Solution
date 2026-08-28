// Public website controller (SYSTEM_PROMPT §5). Unauthenticated; delegates to
// services and returns the standard envelope.
import type { NextFunction, Request, Response } from 'express';
import { sendData } from '../lib/http';
import { listPublishedServices } from '../services/service.service';

export async function getServices(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listPublishedServices());
  } catch (err) {
    next(err);
  }
}
