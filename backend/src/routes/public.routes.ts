// Public, unauthenticated, cached, rate-limited routes (SYSTEM_PROMPT §5, §10):
// everything under /api/v1/public/*.
import { Router } from 'express';
import { createInquirySchema } from '@somwave/shared';
import { publicRateLimiter, inquiryRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import * as publicController from '../controllers/public.controller';

export const publicRouter: Router = Router();

publicRouter.use(publicRateLimiter);

publicRouter.get('/services', publicController.getServices);
publicRouter.get('/portfolio', publicController.getPortfolio);
publicRouter.get('/portfolio/:slug', publicController.getPortfolioItem);
publicRouter.post(
  '/inquiries',
  inquiryRateLimiter,
  validate(createInquirySchema),
  publicController.createInquiry,
);
