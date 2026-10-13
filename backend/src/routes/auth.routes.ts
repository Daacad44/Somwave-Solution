import { Router } from 'express';
import {
  confirmTwoFactorSchema,
  disableTwoFactorSchema,
  forgotPasswordSchema,
  loginSchema,
  regenerateBackupCodesSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyTwoFactorSchema,
  verifyEngineerInvitationSchema,
  activateEngineerInvitationSchema,
  resendEngineerVerificationSchema,
} from '@somwave/shared';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { loginIpRateLimiter, loginAccountRateLimiter } from '../middleware/rateLimit';
import * as authController from '../controllers/auth.controller';
import * as engineerAccountController from '../controllers/engineer-account.controller';

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
authRouter.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
authRouter.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
authRouter.post(
  '/engineer-invitations/verify',
  loginIpRateLimiter,
  validate(verifyEngineerInvitationSchema),
  engineerAccountController.verify,
);
authRouter.post(
  '/engineer-invitations/resend',
  loginIpRateLimiter,
  validate(resendEngineerVerificationSchema),
  loginAccountRateLimiter,
  engineerAccountController.requestResend,
);
authRouter.post(
  '/engineer-invitations/activate',
  loginIpRateLimiter,
  validate(activateEngineerInvitationSchema),
  engineerAccountController.activate,
);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
authRouter.patch('/me', requireAuth, validate(updateProfileSchema), authController.updateProfile);
authRouter.post('/2fa/setup', requireAuth, authController.startTwoFactor);
authRouter.post(
  '/2fa/confirm',
  requireAuth,
  validate(confirmTwoFactorSchema),
  authController.confirmTwoFactor,
);
authRouter.post(
  '/2fa/disable',
  requireAuth,
  validate(disableTwoFactorSchema),
  authController.disableTwoFactor,
);
authRouter.post(
  '/2fa/backup-codes',
  requireAuth,
  validate(regenerateBackupCodesSchema),
  authController.regenerateBackupCodes,
);
