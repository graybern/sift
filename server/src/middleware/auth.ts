import type { Request, Response, NextFunction } from 'express';

// Stub auth middleware — injects default user for single-user mode.
// Replace with real auth (session/JWT) when multi-user is needed.
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  (req as any).userId = 'default';
  next();
}
