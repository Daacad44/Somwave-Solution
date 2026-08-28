// Public, unauthenticated, cached, rate-limited routes (SYSTEM_PROMPT §5, §10):
// everything under /api/v1/public/*.
import { Router } from 'express';
import { publicRateLimiter } from '../middleware/rateLimit';
import * as publicController from '../controllers/public.controller';

export const publicRouter: Router = Router();

publicRouter.use(publicRateLimiter);
publicRouter.get('/services', publicController.getServices);
