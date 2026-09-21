import { Router } from 'express';
import { confirmTwoFactorSchema, loginSchema, verifyTwoFactorSchema } from '@somwave/shared';
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
authRouter.post(
  '/login/2fa',
  loginIpRateLimiter,
  loginAccountRateLimiter,
  validate(verifyTwoFactorSchema),
  authController.verifyTwoFactor,
);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
authRouter.post('/2fa/setup', requireAuth, authController.startTwoFactor);
authRouter.post(
  '/2fa/confirm',
  requireAuth,
  validate(confirmTwoFactorSchema),
  authController.confirmTwoFactor,
);
