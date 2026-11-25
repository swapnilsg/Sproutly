import { Router } from 'express';
import type { Deps } from '../deps.js';

/** Push is on only when both VAPID keys are configured. */
export function pushEnabled(env: Deps['env']): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function notificationRoutes(deps: Deps): Router {
  const router = Router();

  // The public key browsers need to subscribe; null means "remind in the app instead".
  router.get('/config', (_req, res) => {
    res.json({ vapid_public_key: pushEnabled(deps.env) ? deps.env.VAPID_PUBLIC_KEY : null });
  });

  return router;
}
