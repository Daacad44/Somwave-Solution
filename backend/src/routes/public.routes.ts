// Public, unauthenticated, cached, rate-limited routes (SYSTEM_PROMPT §5, §10):
// everything under /api/v1/public/*.
import { Router } from 'express';
import { createInquirySchema, createJobApplicationSchema } from '@somwave/shared';
import { publicRateLimiter, submissionRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import * as publicController from '../controllers/public.controller';

export const publicRouter: Router = Router();

publicRouter.use(publicRateLimiter);

publicRouter.get('/services', publicController.getServices);

publicRouter.get('/portfolio', publicController.getPortfolio);
publicRouter.get('/portfolio/:slug', publicController.getPortfolioItem);

publicRouter.get('/posts', publicController.getPosts);
publicRouter.get('/posts/:slug', publicController.getPost);

publicRouter.get('/testimonials', publicController.getTestimonials);
publicRouter.get('/team', publicController.getTeam);

publicRouter.get('/careers', publicController.getCareers);
publicRouter.get('/careers/:slug', publicController.getCareer);
publicRouter.post(
  '/careers/:slug/applications',
  submissionRateLimiter,
  validate(createJobApplicationSchema),
  publicController.applyToCareer,
);

publicRouter.post(
  '/inquiries',
  submissionRateLimiter,
  validate(createInquirySchema),
  publicController.createInquiry,
);
