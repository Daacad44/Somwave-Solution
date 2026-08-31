// CMS controller (W4, §5, §9). Authenticated content management for the website.
// Delegates to services and returns the standard envelope. No Prisma here.
import type { NextFunction, Request, Response } from 'express';
import type {
  CreateServiceInput,
  UpdateServiceInput,
  CreatePostInput,
  UpdatePostInput,
  CreatePortfolioItemInput,
  UpdatePortfolioItemInput,
  CreateJobOpeningInput,
  UpdateJobOpeningInput,
  CreateTestimonialInput,
  UpdateTestimonialInput,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import * as serviceService from '../services/service.service';
import * as postService from '../services/post.service';
import * as portfolioService from '../services/portfolio.service';
import * as jobService from '../services/job.service';
import * as testimonialService from '../services/testimonial.service';

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

// ── Blog posts (W4.2) ─────────────────────────────────────────────────────────

export async function listPosts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendData(res, await postService.listAllPosts());
  } catch (err) {
    next(err);
  }
}

export async function listCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await postService.listCategories());
  } catch (err) {
    next(err);
  }
}

export async function createPost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await postService.createPost(req.body as CreatePostInput);
    sendData(res, post, 201);
  } catch (err) {
    next(err);
  }
}

export async function updatePost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Maqaalkan lama helin');
    const post = await postService.updatePost(id, req.body as UpdatePostInput);
    sendData(res, post);
  } catch (err) {
    next(err);
  }
}

export async function deletePost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Maqaalkan lama helin');
    await postService.deletePost(id);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}

// ── Portfolio (W4.3) ──────────────────────────────────────────────────────────

export async function listPortfolio(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await portfolioService.listAllPortfolio());
  } catch (err) {
    next(err);
  }
}

export async function createPortfolio(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const item = await portfolioService.createPortfolioItem(req.body as CreatePortfolioItemInput);
    sendData(res, item, 201);
  } catch (err) {
    next(err);
  }
}

export async function updatePortfolio(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Shaqadan lama helin');
    const item = await portfolioService.updatePortfolioItem(
      id,
      req.body as UpdatePortfolioItemInput,
    );
    sendData(res, item);
  } catch (err) {
    next(err);
  }
}

export async function deletePortfolio(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Shaqadan lama helin');
    await portfolioService.deletePortfolioItem(id);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}

// ── Careers / job openings (W4.4) ─────────────────────────────────────────────

export async function listOpenings(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await jobService.listAllOpenings());
  } catch (err) {
    next(err);
  }
}

export async function createOpening(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const opening = await jobService.createOpening(req.body as CreateJobOpeningInput);
    sendData(res, opening, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateOpening(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Fursaddan shaqo lama helin');
    const opening = await jobService.updateOpening(id, req.body as UpdateJobOpeningInput);
    sendData(res, opening);
  } catch (err) {
    next(err);
  }
}

export async function deleteOpening(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Fursaddan shaqo lama helin');
    await jobService.deleteOpening(id);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}

// ── Testimonials (W5.1) ───────────────────────────────────────────────────────

export async function listTestimonials(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendData(res, await testimonialService.listAllTestimonials());
  } catch (err) {
    next(err);
  }
}

export async function createTestimonial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const item = await testimonialService.createTestimonial(req.body as CreateTestimonialInput);
    sendData(res, item, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateTestimonial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Marag-furkan lama helin');
    const item = await testimonialService.updateTestimonial(id, req.body as UpdateTestimonialInput);
    sendData(res, item);
  } catch (err) {
    next(err);
  }
}

export async function deleteTestimonial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) throw new AppError('NOT_FOUND', 404, 'Marag-furkan lama helin');
    await testimonialService.deleteTestimonial(id);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}
