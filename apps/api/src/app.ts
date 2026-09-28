import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { analyticsRoutes } from './analytics/analytics.js';
import { authRoutes } from './auth/routes.js';
import type { Deps } from './deps.js';
import { errorHandler, HttpError } from './errors.js';
import { userRoutes } from './users/routes.js';

export function createApp(deps: Deps) {
  const app = express();
  app.disable('x-powered-by');
  // Behind the Vite dev proxy / Cloudflare, trust the first hop for req.ip.
  app.set('trust proxy', 1);
  app.use(cors({ origin: deps.env.WEB_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.use('/auth', authRoutes(deps));
  api.use('/users', userRoutes(deps));
  api.use('/analytics', analyticsRoutes(deps));
  app.use('/api/v1', api);

  app.use(() => {
    throw new HttpError(404, 'not_found');
  });
  app.use(errorHandler(deps.env.NODE_ENV === 'production'));
  return app;
}
