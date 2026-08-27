// Auth controller (SYSTEM_PROMPT §5): parse the request, delegate to the service,
// set/clear cookies, and return the standard envelope. No Prisma here.
import type { NextFunction, Request, Response } from 'express';
import type { LoginInput } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import { setAuthCookies, clearAuthCookies, readRefreshCookie } from '../lib/cookies';
import * as authService from '../services/auth.service';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as LoginInput;
    const session = await authService.login(email, password);
    setAuthCookies(res, session.accessToken, session.refreshToken);
    sendData(res, { user: session.user });
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
    const session = await authService.refreshSession(token);
    setAuthCookies(res, session.accessToken, session.refreshToken);
    sendData(res, { user: session.user });
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

export async function me(req: Request, res: Response): Promise<void> {
  // requireAuth has populated req.authUser.
  sendData(res, { user: req.authUser });
}
