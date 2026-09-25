import type { NextFunction, Request, Response } from 'express';
import type {
  ConfirmTwoFactorInput,
  DisableTwoFactorInput,
  ForgotPasswordInput,
  LoginInput,
  RegenerateBackupCodesInput,
  ResetPasswordInput,
  UpdateProfileInput,
  VerifyTwoFactorInput,
} from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import { setAuthCookies, clearAuthCookies, readRefreshCookie } from '../lib/cookies';
import * as authService from '../services/auth.service';

function sendSession(
  res: Response,
  session: Awaited<ReturnType<typeof authService.verifyTwoFactorLogin>>,
): void {
  setAuthCookies(res, session.accessToken, session.refreshToken);
  sendData(res, { user: session.user, twoFactorRequired: false });
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as LoginInput;
    const result = await authService.login(email, password);
    if (result.kind === 'twoFactor') {
      sendData(res, { twoFactorRequired: true, challengeToken: result.challengeToken });
      return;
    }
    sendSession(res, result.session);
  } catch (err) {
    next(err);
  }
}

export async function verifyTwoFactor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { challengeToken, code } = req.body as VerifyTwoFactorInput;
    sendSession(res, await authService.verifyTwoFactorLogin(challengeToken, code));
  } catch (err) {
    next(err);
  }
}

export async function startTwoFactor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.authUser?.id;
    if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    sendData(res, await authService.startTwoFactorEnrolment(userId));
  } catch (err) {
    next(err);
  }
}

export async function confirmTwoFactor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.authUser?.id;
    if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const { code } = req.body as ConfirmTwoFactorInput;
    sendData(res, await authService.confirmTwoFactorEnrolment(userId, code));
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readRefreshCookie(req);
    if (!token) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }
    sendSession(res, await authService.refreshSession(token));
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(readRefreshCookie(req));
    clearAuthCookies(res);
    sendData(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email } = req.body as ForgotPasswordInput;
    await authService.requestPasswordReset(email);
    sendData(res, { ok: true });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token, password } = req.body as ResetPasswordInput;
    await authService.resetPassword(token, password);
    sendData(res, { ok: true });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  sendData(res, { user: req.authUser });
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.authUser?.id;
    if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const { name } = req.body as UpdateProfileInput;
    sendData(res, { user: await authService.updateOwnProfile(userId, name) });
  } catch (err) {
    next(err);
  }
}

export async function disableTwoFactor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.authUser?.id;
    if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const { code } = req.body as DisableTwoFactorInput;
    sendData(res, { user: await authService.disableTwoFactor(userId, code) });
  } catch (err) {
    next(err);
  }
}

export async function regenerateBackupCodes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.authUser?.id;
    if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const { code } = req.body as RegenerateBackupCodesInput;
    sendData(res, await authService.regenerateBackupCodes(userId, code));
  } catch (err) {
    next(err);
  }
}
