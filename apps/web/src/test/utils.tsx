import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../routes';
import { useAuth, type Session } from '../stores/auth';
import { useOnboarding } from '../stores/onboarding';

type Handler = (body: unknown) => { status: number; body?: unknown };

/** Stubs fetch with per-path handlers (path is relative to /api/v1). Unknown paths return 404. */
export function mockApi(handlers: Record<string, Handler>) {
  const calls: { path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace('/api/v1', '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, body });
    const result = handlers[path]?.(body) ?? { status: 404, body: { error: 'not_found' } };
    return new Response(result.status === 204 ? null : JSON.stringify(result.body ?? {}), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export function sessionResponse(overrides: Record<string, unknown> = {}) {
  return {
    token: 'access-token',
    user_id: 'user-1',
    onboarding_step: 1,
    onboarding_done: false,
    is_new_user: true,
    ...overrides,
  };
}

export function renderAt(path: string, session: Session | null = null) {
  useAuth.setState({ status: session ? 'signed_in' : 'signed_out', session });
  useOnboarding.setState({ pendingEmail: null, step1StartedAt: null });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
