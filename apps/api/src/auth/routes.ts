import { Router, type Response } from 'express';
import { z } from 'zod';
import type { Deps } from '../deps.js';
import { HttpError } from '../errors.js';
import { enforceRateLimit } from '../rateLimit.js';
import { parseBody } from '../validate.js';
import { signAccessToken } from './accessToken.js';
import { createOtp, OTP_TTL_SECONDS, verifyOtp } from './otp.js';
import {
  issueRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  revokeRefreshFamily,
  rotateRefreshToken,
} from './refreshToken.js';
import { getSessionUser, signInWithEmail, signInWithGoogle, type SessionUser } from './users.js';

export const REFRESH_COOKIE = 'sproutly_rt';

const HOUR = 60 * 60 * 1000;
const limits = {
  startPerIp: { name: 'email-start-ip', limit: 10, windowMs: HOUR },
  startPerEmail: { name: 'email-start-email', limit: 3, windowMs: 15 * 60 * 1000 },
  verifyPerIp: { name: 'email-verify-ip', limit: 30, windowMs: HOUR },
  googlePerIp: { name: 'google-ip', limit: 30, windowMs: HOUR },
};

const email = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email('Enter a valid email address'),
);
const startBody = z.object({ email });
const verifyBody = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
const googleBody = z.object({ credential: z.string().min(1) });

export function authRoutes(deps: Deps): Router {
  const router = Router();
  const secure = deps.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/api/v1/auth',
  };

  async function sendSession(res: Response, user: SessionUser, extra: object = {}) {
    const [token, refresh] = await Promise.all([
      signAccessToken(deps.env.JWT_SECRET, user.id),
      issueRefreshToken(deps.db, user.id),
    ]);
    res.cookie(REFRESH_COOKIE, refresh, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });
    res.json({
      token,
      user_id: user.id,
      onboarding_step: user.onboarding_step,
      onboarding_done: user.onboarding_done,
      ...extra,
    });
  }

  router.post('/email/start', async (req, res) => {
    await enforceRateLimit(deps.redis, limits.startPerIp, req.ip ?? 'unknown');
    const body = parseBody(startBody, req);
    await enforceRateLimit(deps.redis, limits.startPerEmail, body.email);

    const code = await createOtp(deps.redis, deps.env.OTP_SECRET, body.email);
    const minutes = OTP_TTL_SECONDS / 60;
    try {
      await deps.email.send({
        to: body.email,
        subject: `${code} is your Sproutly code`,
        text: `Your Sproutly sign-in code is ${code}. It expires in ${minutes} minutes. If you didn't ask for it, you can ignore this email.`,
        html: `<p>Your Sproutly sign-in code is</p><p style="font-size:28px;letter-spacing:6px;font-weight:600">${code}</p><p>It expires in ${minutes} minutes. If you didn't ask for it, you can ignore this email.</p>`,
      });
    } catch (err) {
      console.error(err);
      throw new HttpError(502, 'email_send_failed');
    }
    // Same response whether or not an account exists.
    res.status(202).json({ sent: true });
  });

  router.post('/email/verify', async (req, res) => {
    await enforceRateLimit(deps.redis, limits.verifyPerIp, req.ip ?? 'unknown');
    const body = parseBody(verifyBody, req);
    await verifyOtp(deps.redis, deps.env.OTP_SECRET, body.email, body.code);
    const { user, isNew } = await signInWithEmail(deps.db, body.email);
    await sendSession(res, user, { is_new_user: isNew });
  });

  router.post('/google', async (req, res) => {
    if (!deps.verifyGoogle) throw new HttpError(503, 'google_not_configured');
    await enforceRateLimit(deps.redis, limits.googlePerIp, req.ip ?? 'unknown');
    const body = parseBody(googleBody, req);
    const profile = await deps.verifyGoogle(body.credential);
    const { user, isNew } = await signInWithGoogle(deps.db, profile);
    await sendSession(res, user, { is_new_user: isNew });
  });

  router.post('/refresh', async (req, res) => {
    const presented: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (!presented) throw new HttpError(401, 'missing_refresh_token');
    try {
      const { userId, token: next } = await rotateRefreshToken(deps.db, presented);
      const user = await getSessionUser(deps.db, userId);
      if (!user) throw new HttpError(401, 'invalid_refresh_token');
      res.cookie(REFRESH_COOKIE, next, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });
      res.json({
        token: await signAccessToken(deps.env.JWT_SECRET, user.id),
        user_id: user.id,
        onboarding_step: user.onboarding_step,
        onboarding_done: user.onboarding_done,
      });
    } catch (err) {
      if (err instanceof HttpError) res.clearCookie(REFRESH_COOKIE, cookieOptions);
      throw err;
    }
  });

  router.post('/logout', async (req, res) => {
    const presented: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (presented) await revokeRefreshFamily(deps.db, presented);
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.status(204).end();
  });

  return router;
}
