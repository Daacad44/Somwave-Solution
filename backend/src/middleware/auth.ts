// Authentication (SYSTEM_PROMPT §5). Reads the access token from its httpOnly
// cookie, verifies it, and loads the user's live roles/permissions onto the
// request. A revoked/inactive user is rejected even with a valid token.
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/http';
import { readAccessCookie } from '../lib/cookies';
import { verifyAccessToken } from '../lib/tokens';
import { getUserAuthContext } from '../services/auth.service';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readAccessCookie(req);
    if (!token) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    let userId: string;
    try {
      userId = verifyAccessToken(token).sub;
    } catch {
      throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired token');
    }

    const context = await getUserAuthContext(userId);
    if (!context) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    req.authUser = context;
    next();
  } catch (err) {
    next(err);
  }
}
