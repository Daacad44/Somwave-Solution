import type { NextFunction, Request, Response } from 'express';
import { AppError, sendData } from '../lib/http';
import {
  NOTIFICATION_EVENTS,
  listNotificationDeliveries,
  listNotificationPreferences,
  setNotificationPreference,
  type NotificationEvent,
} from '../services/notification-delivery.service';

function userId(req: Request): string {
  if (!req.authUser) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return req.authUser.id;
}

export async function preferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listNotificationPreferences(userId(req)));
  } catch (error) {
    next(error);
  }
}

export async function updatePreference(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventKey = req.params.eventKey;
    if (!eventKey || !(NOTIFICATION_EVENTS as readonly string[]).includes(eventKey)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Unknown notification event');
    }
    sendData(
      res,
      await setNotificationPreference(
        userId(req),
        eventKey as NotificationEvent,
        req.body as { inApp: boolean; email: boolean },
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function deliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listNotificationDeliveries(userId(req)));
  } catch (error) {
    next(error);
  }
}
