import { useAuth } from '../stores/auth';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the access token and transparently refresh it once on expiry. Default true. */
  auth?: boolean;
}

async function send(path: string, { method = 'GET', body, auth = true }: Options) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = useAuth.getState().session?.token;
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  return fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function parse<T>(res: Response): Promise<T> {
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'unknown_error', data);
  }
  return data as T;
}

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  let res = await send(path, options);
  if (res.status === 401 && options.auth !== false && useAuth.getState().session) {
    const body = await res
      .clone()
      .json()
      .catch(() => ({}));
    if (body.error === 'token_expired' && (await useAuth.getState().refresh())) {
      res = await send(path, options);
    }
  }
  return parse<T>(res);
}

/** User-facing message for an API error; plain English, never a raw code. */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'rate_limited': {
        const minutes = Math.ceil(Number(err.body.retry_after ?? 60) / 60);
        return `Too many tries — please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`;
      }
      case 'invalid_google_token':
        return "We couldn't sign you in with Google — try again.";
      case 'google_not_configured':
        return 'Google sign-in isn’t available right now — use your email instead.';
      case 'email_send_failed':
        return "We couldn't send the email — try again in a moment.";
    }
  }
  return 'Something went wrong — try again.';
}
