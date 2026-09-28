import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './accessToken.js';

const secret = 'unit-test-secret-unit-test-secret-00';

describe('access tokens', () => {
  it('round-trips the user id', async () => {
    const token = await signAccessToken(secret, 'user-1');
    await expect(verifyAccessToken(secret, token)).resolves.toBe('user-1');
  });

  it('reports token_expired for an expired token', async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('sproutly')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(secret));
    await expect(verifyAccessToken(secret, expired)).rejects.toMatchObject({
      status: 401,
      code: 'token_expired',
    });
  });

  it('reports invalid_token for a token signed with another secret', async () => {
    const token = await signAccessToken('another-secret-another-secret-00000', 'user-1');
    await expect(verifyAccessToken(secret, token)).rejects.toMatchObject({
      code: 'invalid_token',
    });
  });
});
