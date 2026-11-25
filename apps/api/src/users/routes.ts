import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import type { Deps } from '../deps.js';
import { HttpError } from '../errors.js';

export function userRoutes(deps: Deps): Router {
  const router = Router();

  router.get('/me/onboarding-state', requireAuth(deps.env.JWT_SECRET), async (_req, res) => {
    const { rows } = await deps.db.query(
      `SELECT u.email, u.name, u.location_raw, u.space_types, u.experience_level,
              u.onboarding_step, u.onboarding_done,
              (SELECT p.name FROM gardens g
                 JOIN garden_plants gp ON gp.garden_id = g.id AND gp.position = 0
                 JOIN plants p ON p.id = gp.plant_id
               WHERE g.user_id = u.id) AS first_plant_name
       FROM users u WHERE u.id = $1`,
      [res.locals.userId],
    );
    if (!rows[0]) throw new HttpError(404, 'user_not_found');
    res.json(rows[0]);
  });

  return router;
}
