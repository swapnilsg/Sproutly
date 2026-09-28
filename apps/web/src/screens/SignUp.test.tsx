import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useOnboarding } from '../stores/onboarding';
import { mockApi, renderAt, sessionResponse } from '../test/utils';

describe('Sign-up screen', () => {
  it('shows the branded headline and no Google button without a client id', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    renderAt('/onboarding/1');
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeVisible();
    expect(screen.getByText('Grow with confidence, one plant at a time')).toBeVisible();
    expect(screen.queryByTestId('google-button')).not.toBeInTheDocument();
  });

  it('validates the email before sending anything', async () => {
    const { calls } = mockApi({ '/analytics/events': () => ({ status: 202 }) });
    renderAt('/onboarding/1');
    await userEvent.type(await screen.findByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(calls.some((c) => c.path === '/auth/email/start')).toBe(false);
  });

  it('sends a code and moves to the code screen', async () => {
    const { calls } = mockApi({
      '/analytics/events': () => ({ status: 202 }),
      '/auth/email/start': () => ({ status: 202, body: { sent: true } }),
    });
    const router = renderAt('/onboarding/1');
    await userEvent.type(await screen.findByLabelText('Email'), '  Sam@Example.com ');
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/onboarding/1/code');
    expect(screen.getByText('sam@example.com')).toBeVisible();
    expect(calls.find((c) => c.path === '/auth/email/start')?.body).toEqual({
      email: 'sam@example.com',
    });
    expect(
      calls.some((c) => (c.body as { event_name?: string })?.event_name === 'onboarding_started'),
    ).toBe(true);
  });

  it('explains rate limiting in plain English', async () => {
    mockApi({
      '/analytics/events': () => ({ status: 202 }),
      '/auth/email/start': () => ({
        status: 429,
        body: { error: 'rate_limited', retry_after: 600 },
      }),
    });
    renderAt('/onboarding/1');
    await userEvent.type(await screen.findByLabelText('Email'), 'sam@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many tries — please wait 10 minutes and try again.',
    );
  });
});

describe('Code screen', () => {
  function atCodeScreen() {
    const router = renderAt('/onboarding/1');
    useOnboarding.setState({ pendingEmail: 'sam@example.com' });
    void router.navigate('/onboarding/1/code');
    return router;
  }

  it('redirects to step 1 when there is no pending email', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = renderAt('/onboarding/1/code');
    await screen.findByRole('heading', { name: 'Create your account' });
    expect(router.state.location.pathname).toBe('/onboarding/1');
  });

  it('auto-submits six digits and continues to step 2', async () => {
    const { calls } = mockApi({
      '/analytics/events': () => ({ status: 202 }),
      '/auth/email/verify': () => ({ status: 200, body: sessionResponse() }),
    });
    const router = atCodeScreen();
    await userEvent.type(await screen.findByLabelText('Sign-in code'), '12 34-56');

    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding/2'));
    expect(calls.find((c) => c.path === '/auth/email/verify')?.body).toEqual({
      email: 'sam@example.com',
      code: '123456',
    });
    const completed = calls.find(
      (c) => (c.body as { event_name?: string })?.event_name === 'onboarding_step_completed',
    );
    expect(completed?.body).toMatchObject({ properties: { step: 1, method: 'email' } });
    expect(useOnboarding.getState().pendingEmail).toBeNull();
  });

  it('sends a returning user to the step they left off at', async () => {
    mockApi({
      '/analytics/events': () => ({ status: 202 }),
      '/auth/email/verify': () => ({
        status: 200,
        body: sessionResponse({ onboarding_step: 7, onboarding_done: true, is_new_user: false }),
      }),
    });
    const router = atCodeScreen();
    await userEvent.type(await screen.findByLabelText('Sign-in code'), '123456');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('clears the input after a wrong code', async () => {
    mockApi({
      '/analytics/events': () => ({ status: 202 }),
      '/auth/email/verify': () => ({
        status: 400,
        body: { error: 'invalid_code', attempts_left: 4 },
      }),
    });
    atCodeScreen();
    const input = await screen.findByLabelText('Sign-in code');
    await userEvent.type(input, '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "That code didn't match — try again.",
    );
    expect(input).toHaveValue('');
  });

  it('sends a fresh code when the old one expired', async () => {
    const { calls } = mockApi({
      '/analytics/events': () => ({ status: 202 }),
      '/auth/email/verify': () => ({ status: 400, body: { error: 'code_expired' } }),
      '/auth/email/start': () => ({ status: 202, body: { sent: true } }),
    });
    atCodeScreen();
    await userEvent.type(await screen.findByLabelText('Sign-in code'), '123456');
    expect(await screen.findByRole('status')).toHaveTextContent(
      "That code expired — we've sent you a new one.",
    );
    expect(calls.filter((c) => c.path === '/auth/email/start')).toHaveLength(1);
  });

  it('holds the resend link for 30 seconds', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    atCodeScreen();
    expect(await screen.findByRole('button', { name: /Resend code in \d+s/ })).toBeDisabled();
  });
});

describe('Route guards', () => {
  const session = { token: 't', userId: 'u', onboardingStep: 1, onboardingDone: false };

  it('sends signed-out visitors to step 1', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = renderAt('/onboarding/3');
    await screen.findByRole('heading', { name: 'Create your account' });
    expect(router.state.location.pathname).toBe('/onboarding/1');
  });

  it('skips step 1 for signed-in users', async () => {
    const router = renderAt('/onboarding/1', session);
    await screen.findByRole('heading', { name: 'Onboarding step 2' });
    expect(router.state.location.pathname).toBe('/onboarding/2');
  });

  it('does not allow jumping ahead', async () => {
    const router = renderAt('/onboarding/6', session);
    await screen.findByRole('heading', { name: 'Onboarding step 2' });
    expect(router.state.location.pathname).toBe('/onboarding/2');
  });

  it('logs out back to step 1', async () => {
    const { calls } = mockApi({
      '/auth/logout': () => ({ status: 204 }),
      '/analytics/events': () => ({ status: 202 }),
    });
    renderAt('/dashboard', { ...session, onboardingStep: 7, onboardingDone: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    await screen.findByRole('heading', { name: 'Create your account' });
    expect(calls.some((c) => c.path === '/auth/logout')).toBe(true);
  });
});
