import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import type { Deps } from '../deps.js';
import { HttpError } from '../errors.js';

export function userRoutes(deps: Deps): Router {
  const router = Router();

  router.get('/me/onboarding-state', requireAuth(deps.env.JWT_SECRET), async (_req, res) => {
    const { rows } = await deps.db.query(
      `SELECT email, name, location_raw, space_types, experience_level,
              onboarding_step, onboarding_done
       FROM users WHERE id = $1`,
      [res.locals.userId],
    );
    if (!rows[0]) throw new HttpError(404, 'user_not_found');
    res.json(rows[0]);
  });

  return router;
}
