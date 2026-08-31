// Public website controller (SYSTEM_PROMPT §5). Unauthenticated; delegates to
// services and returns the standard envelope.
import type { NextFunction, Request, Response } from 'express';
import type { CreateInquiryInput, CreateJobApplicationInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@somwave/shared';
import { listPublishedServices } from '../services/service.service';
import { createInquiry as createInquiryService } from '../services/inquiry.service';
import { listPublishedPortfolio, getPortfolioBySlug } from '../services/portfolio.service';
import { listPublishedPosts, getPostBySlug } from '../services/post.service';
import { listPublishedOpenings, getOpeningBySlug, applyToOpening } from '../services/job.service';
import { listPublishedTestimonials } from '../services/testimonial.service';
import { listPublishedTeam } from '../services/team.service';
import { listPublishedFaqs } from '../services/faq.service';

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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

export async function getPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const pageSize = parsePositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE);
    const result = await listPublishedPosts(page, pageSize);
    sendData(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params;
    const post = slug ? await getPostBySlug(slug) : null;
    if (!post) throw new AppError('NOT_FOUND', 404, 'Maqaalkan lama helin');
    sendData(res, post);
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

export async function getCareers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listPublishedOpenings());
  } catch (err) {
    next(err);
  }
}

export async function getTestimonials(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await listPublishedTestimonials());
  } catch (err) {
    next(err);
  }
}

export async function getTeam(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listPublishedTeam());
  } catch (err) {
    next(err);
  }
}

export async function getFaqs(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listPublishedFaqs());
  } catch (err) {
    next(err);
  }
}

export async function getCareer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params;
    const opening = slug ? await getOpeningBySlug(slug) : null;
    if (!opening) throw new AppError('NOT_FOUND', 404, 'Fursaddan shaqo lama helin');
    sendData(res, opening);
  } catch (err) {
    next(err);
  }
}

export async function applyToCareer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { slug } = req.params;
    const idempotencyKey = req.header('Idempotency-Key');
    if (!slug) throw new AppError('NOT_FOUND', 404, 'Fursaddan shaqo lama helin');
    if (!idempotencyKey) {
      throw new AppError('VALIDATION_ERROR', 400, 'Idempotency-Key header ayaa loo baahan yahay');
    }
    const result = await applyToOpening(
      slug,
      req.body as CreateJobApplicationInput,
      idempotencyKey,
    );
    sendData(res, result, 201);
  } catch (err) {
    next(err);
  }
}
