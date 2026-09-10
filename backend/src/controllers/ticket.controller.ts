import type { NextFunction, Request, Response } from 'express';
import { ROLES, type CreateTicketInput, type UpdateTicketInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as ticketService from '../services/ticket.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = req.authUser?.roles ?? [];
    const clientId = roles.includes(ROLES.CLIENT) ? (req.authUser?.clientId ?? null) : null;
    if (roles.includes(ROLES.CLIENT) && !clientId) {
      throw new AppError('NOT_FOUND', 404, 'Tikidh lama helin');
    }
    sendData(res, await ticketService.listTickets(clientId));
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
    const body = req.body as UpdateTicketInput;
    if (!body.status) throw new AppError('VALIDATION_ERROR', 400, 'Xaaladda waa waajib');
    sendData(res, await ticketService.updateTicketStatus(id, body.status));
  } catch (err) {
    next(err);
  }
}
