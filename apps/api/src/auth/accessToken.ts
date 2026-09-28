import { errors, jwtVerify, SignJWT } from 'jose';
import { HttpError } from '../errors.js';

const ISSUER = 'sproutly';
export const ACCESS_TOKEN_TTL = '15m';

const keyCache = new Map<string, Uint8Array>();
function key(secret: string): Uint8Array {
  let k = keyCache.get(secret);
  if (!k) {
    k = new TextEncoder().encode(secret);
    keyCache.set(secret, k);
  }
  return k;
}

export function signAccessToken(secret: string, userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(key(secret));
}

/** Returns the user id, or throws 401 `token_expired` / `invalid_token`. */
export async function verifyAccessToken(secret: string, token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      algorithms: ['HS256'],
    });
    if (!payload.sub) throw new HttpError(401, 'invalid_token');
    return payload.sub;
  } catch (err) {
    if (err instanceof errors.JWTExpired) throw new HttpError(401, 'token_expired');
    throw new HttpError(401, 'invalid_token');
  }
}
