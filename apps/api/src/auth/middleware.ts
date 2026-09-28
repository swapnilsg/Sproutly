import type { Request, RequestHandler } from 'express';
import { HttpError } from '../errors.js';
import { verifyAccessToken } from './accessToken.js';

function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

/** Rejects the request unless it carries a valid access token; sets `res.locals.userId`. */
export function requireAuth(jwtSecret: string): RequestHandler {
  return async (req, res, next) => {
    const token = bearer(req);
    if (!token) throw new HttpError(401, 'missing_token');
    res.locals.userId = await verifyAccessToken(jwtSecret, token);
    next();
  };
}

/** Sets `res.locals.userId` when a valid access token is present; never rejects. */
export function optionalAuth(jwtSecret: string): RequestHandler {
  return async (req, res, next) => {
    const token = bearer(req);
    if (token) {
      res.locals.userId = await verifyAccessToken(jwtSecret, token).catch(() => undefined);
    }
    next();
  };
}
