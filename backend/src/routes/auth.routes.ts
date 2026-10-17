import { Router } from 'express';
import {
  verifyPasswordResetSchema,
  verifyUserInvitationSchema,
  activateUserInvitationSchema,
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
import * as invitations from '../services/user-invitation.service';
import { sendData } from '../lib/http';
import * as authService from '../services/auth.service';
import * as authController from '../controllers/auth.controller';
import * as engineerAccountController from '../controllers/engineer-account.controller';

export const authRouter: Router = Router();
authRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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
authRouter.post(
  '/forgot-password',
  loginIpRateLimiter,
  validate(forgotPasswordSchema),
  loginAccountRateLimiter,
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  loginIpRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
authRouter.post(
  '/password-reset/verify',
  loginIpRateLimiter,
  validate(verifyPasswordResetSchema),
  loginAccountRateLimiter,
  async (req, res, next) => {
    try {
      sendData(res, await authService.verifyPasswordResetCode(req.body.email, req.body.code));
    } catch (e) {
      next(e);
    }
  },
);
authRouter.post(
  '/user-invitations/verify',
  loginIpRateLimiter,
  validate(verifyUserInvitationSchema),
  async (req, res, next) => {
    try {
      sendData(res, await invitations.verifyInvitation(req.body.token));
    } catch (e) {
      next(e);
    }
  },
);
authRouter.post(
  '/user-invitations/activate',
  loginIpRateLimiter,
  validate(activateUserInvitationSchema),
  async (req, res, next) => {
    try {
      sendData(res, await invitations.activateInvitation(req.body.token, req.body.password));
    } catch (e) {
      next(e);
    }
  },
);
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
