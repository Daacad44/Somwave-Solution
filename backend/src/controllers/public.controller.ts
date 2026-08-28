// Public website controller (SYSTEM_PROMPT §5). Unauthenticated; delegates to
// services and returns the standard envelope.
import type { NextFunction, Request, Response } from 'express';
import type { CreateInquiryInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import { listPublishedServices } from '../services/service.service';
import { createInquiry as createInquiryService } from '../services/inquiry.service';
import { listPublishedPortfolio, getPortfolioBySlug } from '../services/portfolio.service';

export async function getServices(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listPublishedServices());
  } catch (err) {
    next(err);
  }
}

export async function getPortfolio(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await listPublishedPortfolio());
  } catch (err) {
    next(err);
  }
}

export async function getPortfolioItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { slug } = req.params;
    const item = slug ? await getPortfolioBySlug(slug) : null;
    if (!item) throw new AppError('NOT_FOUND', 404, 'Shaqadan lama helin');
    sendData(res, item);
  } catch (err) {
    next(err);
  }
}

export async function createInquiry(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const idempotencyKey = req.header('Idempotency-Key');
    if (!idempotencyKey) {
      throw new AppError('VALIDATION_ERROR', 400, 'Idempotency-Key header ayaa loo baahan yahay');
    }
    const result = await createInquiryService(req.body as CreateInquiryInput, idempotencyKey);
    sendData(res, result, 201);
  } catch (err) {
    next(err);
  }
}
