import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import type { Deps } from '../deps.js';
import { parseBody } from '../validate.js';
import { setupBody, setupGarden } from './setup.js';

export function onboardingRoutes(deps: Deps): Router {
  const router = Router();

  // Saves the step 2–5 answers after sign-in and creates the garden and first tasks.
  router.post('/setup', requireAuth(deps.env.JWT_SECRET), async (req, res) => {
    const body = parseBody(setupBody, req);
    const result = await setupGarden(deps.db, res.locals.userId, body);
    res.status(201).json(result);
  });

  return router;
}
