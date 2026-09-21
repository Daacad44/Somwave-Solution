import type { NextFunction, Request, Response } from 'express';
import {
  ROLES,
  type CreateTicketInput,
  type CreateTicketReplyInput,
  type UpdateTicketInput,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as ticketService from '../services/ticket.service';

function scopedClientId(req: Request): string | null {
  const roles = req.authUser?.roles ?? [];
  if (roles.includes(ROLES.CLIENT)) {
    return req.authUser?.clientId ?? null;
  }
  return null;
}

function requireScopedClient(req: Request): string | null {
  const roles = req.authUser?.roles ?? [];
  if (roles.includes(ROLES.CLIENT) && !req.authUser?.clientId) {
    throw new AppError('NOT_FOUND', 404, 'Tikidh lama helin');
  }
  return scopedClientId(req);
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await ticketService.listTickets(requireScopedClient(req)));
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Tikidhkan lama helin');
    sendData(res, await ticketService.getTicket(id, requireScopedClient(req)));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = req.authUser?.clientId;
    if (!clientId) throw new AppError('NOT_FOUND', 404, 'Tikidh lama helin');
    sendData(res, await ticketService.createTicket(clientId, req.body as CreateTicketInput), 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Tikidhkan lama helin');
    sendData(
      res,
      await ticketService.updateTicket(id, req.body as UpdateTicketInput, requireScopedClient(req)),
    );
  } catch (err) {
    next(err);
  }
}

export async function listAssignees(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await ticketService.listAssignees());
  } catch (err) {
    next(err);
  }
}

export async function createReply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const authorId = req.authUser?.id;
    if (!id || !authorId) throw new AppError('NOT_FOUND', 404, 'Tikidhkan lama helin');
    sendData(
      res,
      await ticketService.createReply(
        id,
        authorId,
        req.body as CreateTicketReplyInput,
        requireScopedClient(req),
      ),
      201,
    );
  } catch (err) {
    next(err);
  }
}
