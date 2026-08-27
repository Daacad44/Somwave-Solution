// Attach the authenticated user's identity, roles, and permissions to the
// request after requireAuth (SYSTEM_PROMPT §5).
import 'express';

declare global {
  namespace Express {
    interface AuthUserContext {
      id: string;
      roles: string[];
      permissions: string[];
    }
    interface Request {
      authUser?: AuthUserContext;
    }
  }
}

export {};
