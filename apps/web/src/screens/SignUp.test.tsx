import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useOnboarding } from '../stores/onboarding';
import { mockApi, renderAt, sessionResponse } from '../test/utils';

describe('Save your garden (sign-up, step 6)', () => {
  it('shows the save headline and no Google button without a client id', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    renderAt('/onboarding/6');
    expect(await screen.findByRole('heading', { name: 'Your garden is ready 🌱' })).toBeVisible();
    expect(
      screen.getByText('Save it so we can remind you when your plants need you.'),
    ).toBeVisible();
    expect(screen.getByText('Grow with confidence, one plant at a time')).toBeVisible();
    expect(screen.queryByTestId('google-button')).not.toBeInTheDocument();
  });

  it('validates the email before sending anything', async () => {
    const { calls } = mockApi({ '/analytics/events': () => ({ status: 202 }) });
    renderAt('/onboarding/6');
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
    const router = renderAt('/onboarding/6');
    await userEvent.type(await screen.findByLabelText('Email'), '  Sam@Example.com ');
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/onboarding/6/code');
    expect(screen.getByText('sam@example.com')).toBeVisible();
    expect(calls.find((c) => c.path === '/auth/email/start')?.body).toEqual({
      email: 'sam@example.com',
    });
  });

  it('explains rate limiting in plain English', async () => {
    mockApi({
      '/analytics/events': () => ({ status: 202 }),
      '/auth/email/start': () => ({
        status: 429,
        body: { error: 'rate_limited', retry_after: 600 },
      }),
    });
    renderAt('/onboarding/6');
    await userEvent.type(await screen.findByLabelText('Email'), 'sam@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many tries — please wait 10 minutes and try again.',
    );
  });
});

describe('Code screen', () => {
  function atCodeScreen(base = '/onboarding/6') {
    const router = renderAt(base);
    useOnboarding.setState({ pendingEmail: 'sam@example.com' });
    void router.navigate(`${base}/code`);
    return router;
  }

  it('redirects back to the email step when there is no pending email', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = renderAt('/onboarding/6/code');
    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(router.state.location.pathname).toBe('/onboarding/6');
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
    expect(completed?.body).toMatchObject({ properties: { step: 6, method: 'email' } });
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

  it('"Use a different email" returns to the email step it came from', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = atCodeScreen('/signin');
    await userEvent.click(await screen.findByRole('button', { name: 'Use a different email' }));
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('holds the resend link for 30 seconds', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    atCodeScreen();
    expect(await screen.findByRole('button', { name: /Resend code in \d+s/ })).toBeDisabled();
  });
});

describe('Sign in (returning users)', () => {
  it('shows the welcome-back headline', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    renderAt('/signin');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.getByText('Sign in to see your garden.')).toBeVisible();
  });

  it('uses the /signin code route and records no onboarding step for a returning user', async () => {
    const { calls } = mockApi({
      '/analytics/events': () => ({ status: 202 }),
      '/auth/email/start': () => ({ status: 202, body: { sent: true } }),
      '/auth/email/verify': () => ({
        status: 200,
        body: sessionResponse({ onboarding_step: 7, onboarding_done: true, is_new_user: false }),
      }),
    });
    const router = renderAt('/signin');
    await userEvent.type(await screen.findByLabelText('Email'), 'sam@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }));
    await screen.findByRole('heading', { name: 'Check your email' });
    expect(router.state.location.pathname).toBe('/signin/code');

    await userEvent.type(screen.getByLabelText('Sign-in code'), '123456');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(
      calls.some(
        (c) => (c.body as { event_name?: string })?.event_name === 'onboarding_step_completed',
      ),
    ).toBe(false);
  });

  it('records step 6 when someone new signs in from /signin', async () => {
    const { calls } = mockApi({
      '/analytics/events': () => ({ status: 202 }),
      '/auth/email/start': () => ({ status: 202, body: { sent: true } }),
      '/auth/email/verify': () => ({ status: 200, body: sessionResponse({ is_new_user: true }) }),
    });
    renderAt('/signin');
    await userEvent.type(await screen.findByLabelText('Email'), 'new@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }));
    await userEvent.type(await screen.findByLabelText('Sign-in code'), '123456');
    await waitFor(() =>
      expect(
        calls.find(
          (c) => (c.body as { event_name?: string })?.event_name === 'onboarding_step_completed',
        )?.body,
      ).toMatchObject({ properties: { step: 6, is_new_user: true } }),
    );
  });
});

describe('Route guards', () => {
  const session = { token: 't', userId: 'u', onboardingStep: 1, onboardingDone: false };

  it('sends signed-out visitors to the welcome screen', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = renderAt('/onboarding/3');
    await screen.findByRole('heading', { name: 'Keep your first plants alive' });
    expect(router.state.location.pathname).toBe('/onboarding/1');
  });

  it('skips the guest screens for signed-in users', async () => {
    const router = renderAt('/onboarding/1', session);
    await screen.findByRole('heading', { name: 'Onboarding step 2' });
    expect(router.state.location.pathname).toBe('/onboarding/2');
  });

  it('does not allow jumping ahead', async () => {
    const router = renderAt('/onboarding/5', session);
    await screen.findByRole('heading', { name: 'Onboarding step 2' });
    expect(router.state.location.pathname).toBe('/onboarding/2');
  });

  it('logs out back to the welcome screen', async () => {
    const { calls } = mockApi({
      '/auth/logout': () => ({ status: 204 }),
      '/analytics/events': () => ({ status: 202 }),
    });
    renderAt('/dashboard', { ...session, onboardingStep: 7, onboardingDone: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    await screen.findByRole('heading', { name: 'Keep your first plants alive' });
    expect(calls.some((c) => c.path === '/auth/logout')).toBe(true);
  });
});
