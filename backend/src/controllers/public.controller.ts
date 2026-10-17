import type { NextFunction, Request, Response } from 'express';
import type { CreateInquiryInput, CreateJobApplicationInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, defaultSiteContent } from '@somwave/shared';
import { listPublishedServices, getPublishedServiceBySlug } from '../services/service.service';
import { createInquiry as createInquiryService } from '../services/inquiry.service';
import {
  listPublishedPortfolio,
  getPortfolioBySlug,
  recordPortfolioDemoClick,
} from '../services/portfolio.service';
import { listPublishedPosts, getPostBySlug } from '../services/post.service';
import { readPublicArticleImage } from '../services/articleImage.service';
import { listPublishedOpenings, getOpeningBySlug, applyToOpening } from '../services/job.service';
import { listPublishedTestimonials } from '../services/testimonial.service';
import { listPublishedTeam } from '../services/team.service';
import { listPublishedFaqs } from '../services/faq.service';
import { subscribe as subscribeService } from '../services/subscriber.service';
import { readSiteContent } from '../services/site-content.service';

export async function getHomepage(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [siteContent, services, portfolio, testimonials, posts, faqs] = await Promise.allSettled([
      readSiteContent(),
      listPublishedServices(),
      listPublishedPortfolio(),
      listPublishedTestimonials(),
      listPublishedPosts(1, 3),
      listPublishedFaqs(),
    ]);
    sendData(res, {
      siteContent: siteContent.status === 'fulfilled' ? siteContent.value : defaultSiteContent,
      services: services.status === 'fulfilled' ? services.value : null,
      portfolio: portfolio.status === 'fulfilled' ? portfolio.value : null,
      testimonials: testimonials.status === 'fulfilled' ? testimonials.value : null,
      posts: posts.status === 'fulfilled' ? posts.value.items : null,
      faqs: faqs.status === 'fulfilled' ? faqs.value : null,
    });
  } catch (err) {
    next(err);
  }
}
import type { CreateSubscriberInput } from '@somwave/shared';

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getSiteContent(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await readSiteContent());
  } catch (err) {
    next(err);
  }
}

export async function getServices(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await listPublishedServices());
  } catch (err) {
    next(err);
  }
}

export async function getService(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params;
    const service = slug ? await getPublishedServiceBySlug(slug) : null;
    if (!service) throw new AppError('NOT_FOUND', 404, 'Service not found');
    sendData(res, service);
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
    if (!item) throw new AppError('NOT_FOUND', 404, 'Portfolio item not found');
    sendData(res, item);
  } catch (err) {
    next(err);
  }
}

export async function recordDemoClick(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Live demo unavailable');
    sendData(res, await recordPortfolioDemoClick(id));
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
    if (!post) throw new AppError('NOT_FOUND', 404, 'Article not found');
    sendData(res, post);
  } catch (err) {
    next(err);
  }
}

export async function getArticleImage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Image not found');
    const file = await readPublicArticleImage(id);
    if ('redirect' in file) {
      // Stored in ImageKit: the CDN serves it; the API URL stays valid for old content.
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.redirect(302, file.redirect);
      return;
    }
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.bytes);
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

export async function subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await subscribeService(req.body as CreateSubscriberInput);
    sendData(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function getCareer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params;
    const opening = slug ? await getOpeningBySlug(slug) : null;
    if (!opening) throw new AppError('NOT_FOUND', 404, 'Job opening not found');
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
    if (!slug) throw new AppError('NOT_FOUND', 404, 'Job opening not found');
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
