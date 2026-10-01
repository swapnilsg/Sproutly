import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderAt } from '../test/utils';

const startedEvents = (calls: { body: unknown }[]) =>
  calls.filter((c) => (c.body as { event_name?: string })?.event_name === 'onboarding_started');

describe('Welcome screen (step 1)', () => {
  it('states the promise and offers both ways in', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    renderAt('/onboarding/1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Keep your first plants alive' }),
    ).toBeVisible();
    expect(screen.getByText("We'll tell you exactly what to do, every day.")).toBeVisible();
    expect(screen.getByRole('link', { name: 'Start my garden' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'I already have an account' })).toBeVisible();
    expect(screen.getByText('Free · takes about 2 minutes')).toBeVisible();
  });

  it('hides the decorative task preview from screen readers', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    renderAt('/onboarding/1');
    await screen.findByRole('heading', { name: 'Keep your first plants alive' });
    expect(screen.queryByText('Water your basil')).not.toBeNull();
    expect(screen.getByText('Water your basil').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('is the landing page for signed-out visitors', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = renderAt('/');
    await screen.findByRole('heading', { name: 'Keep your first plants alive' });
    expect(router.state.location.pathname).toBe('/onboarding/1');
  });

  it('"Start my garden" goes to step 2', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = renderAt('/onboarding/1');
    await userEvent.click(await screen.findByRole('link', { name: 'Start my garden' }));
    await screen.findByRole('heading', { name: 'Where will your plants live?' });
    expect(router.state.location.pathname).toBe('/onboarding/2');
  });

  it('"I already have an account" goes to sign-in', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = renderAt('/onboarding/1');
    await userEvent.click(await screen.findByRole('link', { name: 'I already have an account' }));
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('fires onboarding_started once per onboarding attempt', async () => {
    const { calls } = mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = renderAt('/onboarding/1');
    await screen.findByRole('heading', { name: 'Keep your first plants alive' });
    expect(startedEvents(calls)).toHaveLength(1);

    // Leaving and coming back in the same attempt doesn't count as a new start.
    await router.navigate('/signin');
    await router.navigate('/onboarding/1');
    await screen.findByRole('heading', { name: 'Keep your first plants alive' });
    expect(startedEvents(calls)).toHaveLength(1);
  });

  it('sends signed-in users to where they left off', async () => {
    const router = renderAt('/onboarding/1', {
      token: 't',
      userId: 'u',
      onboardingStep: 1,
      onboardingDone: false,
    });
    await screen.findByRole('heading', { name: 'Where will your plants live?' });
    expect(router.state.location.pathname).toBe('/onboarding/2');
  });
});
