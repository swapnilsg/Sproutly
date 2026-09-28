import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import { HttpError } from '../errors.js';

export const OTP_TTL_SECONDS = 600;
export const OTP_MAX_ATTEMPTS = 5;

const otpKey = (email: string) => `otp:${email}`;
const hmac = (secret: string, email: string, code: string) =>
  createHmac('sha256', secret).update(`${email}:${code}`).digest();

/** Creates a fresh 6-digit code for the email, replacing any previous one. */
export async function createOtp(redis: Redis, secret: string, email: string): Promise<string> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await redis
    .multi()
    .del(otpKey(email))
    .hset(otpKey(email), { hash: hmac(secret, email, code).toString('hex'), attempts: 0 })
    .expire(otpKey(email), OTP_TTL_SECONDS)
    .exec();
  return code;
}

// Atomically read the stored hash and count this attempt, without creating a missing key.
const ATTEMPT_SCRIPT = `
local h = redis.call('HGET', KEYS[1], 'hash')
if not h then return {} end
local a = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
return {h, a}
`;

/**
 * Consumes the code if it matches.
 * Throws 400 `code_expired` (none pending), 400 `invalid_code`,
 * or 429 `too_many_attempts` (code burned).
 */
export async function verifyOtp(
  redis: Redis,
  secret: string,
  email: string,
  code: string,
): Promise<void> {
  const result = (await redis.eval(ATTEMPT_SCRIPT, 1, otpKey(email))) as [string, number] | [];
  if (result.length === 0) throw new HttpError(400, 'code_expired');
  const [storedHex, attempts] = result;

  const matches = timingSafeEqual(Buffer.from(storedHex, 'hex'), hmac(secret, email, code));
  if (matches) {
    await redis.del(otpKey(email));
    return;
  }
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(otpKey(email));
    throw new HttpError(429, 'too_many_attempts');
  }
  throw new HttpError(400, 'invalid_code', { attempts_left: OTP_MAX_ATTEMPTS - attempts });
}
