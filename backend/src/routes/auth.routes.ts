// Auth routes (SYSTEM_PROMPT §10: /api/v1/auth). Thin: rate limit + validate +
// delegate to the controller.
import { Router } from 'express';
import { loginSchema } from '@somwave/shared';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { loginIpRateLimiter, loginAccountRateLimiter } from '../middleware/rateLimit';
import * as authController from '../controllers/auth.controller';

export const authRouter: Router = Router();

authRouter.post(
  '/login',
  loginIpRateLimiter,
  loginAccountRateLimiter,
  validate(loginSchema),
  authController.login,
);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
