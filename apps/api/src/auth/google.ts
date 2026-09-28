import { OAuth2Client } from 'google-auth-library';
import { HttpError } from '../errors.js';

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
}

/** Verifies a Google Identity Services credential (ID token) and returns the profile. */
export type GoogleVerifier = (credential: string) => Promise<GoogleProfile>;

export function createGoogleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client();
  return async (credential) => {
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new HttpError(401, 'invalid_google_token');
    }
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new HttpError(401, 'invalid_google_token');
    }
    return { sub: payload.sub, email: payload.email.toLowerCase(), name: payload.given_name };
  };
}
