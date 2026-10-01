import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useOnboarding } from '../../stores/onboarding';
import { mockApi, renderAt } from '../../test/utils';

type Call = { path: string; body: unknown };
const event = (calls: Call[], name: string) =>
  calls.find((c) => (c.body as { event_name?: string })?.event_name === name)?.body;

const tile = (name: RegExp) => screen.getByRole('button', { name });

async function atStep2(session: Parameters<typeof renderAt>[1] = null) {
  const api = mockApi({ '/analytics/events': () => ({ status: 202 }) });
  const router = renderAt('/onboarding/2', session);
  await screen.findByRole('heading', { name: 'Where will your plants live?' });
  return { ...api, router };
}

describe('Step 2 — where will your plants live?', () => {
  it('pre-selects Balcony and shows progress 1 of 5', async () => {
    await atStep2();
    expect(tile(/^Balcony/)).toHaveAttribute('aria-pressed', 'true');
    expect(tile(/^Indoors/)).toHaveAttribute('aria-pressed', 'false');
    expect(tile(/^Not sure yet/)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 of 5')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Where will your plants live?' })).toBeVisible();
  });

  it('allows several places, and "Not sure yet" is exclusive', async () => {
    await atStep2();
    await userEvent.click(tile(/^Indoors/));
    expect(tile(/^Balcony/)).toHaveAttribute('aria-pressed', 'true');
    expect(tile(/^Indoors/)).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(tile(/^Not sure yet/));
    expect(tile(/^Balcony/)).toHaveAttribute('aria-pressed', 'false');
    expect(tile(/^Indoors/)).toHaveAttribute('aria-pressed', 'false');
    expect(tile(/^Not sure yet/)).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(tile(/^Balcony/));
    expect(tile(/^Not sure yet/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('asks for at least one place when nothing is selected', async () => {
    await atStep2();
    await userEvent.click(tile(/^Balcony/));
    expect(screen.getByRole('button', { name: 'Pick at least one place' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'That’s where they’ll live' })).toBeNull();
  });

  it('saves the answer, tracks it and continues to Save your garden', async () => {
    const { calls, router } = await atStep2();
    await userEvent.click(tile(/^Indoors/));
    await userEvent.click(screen.getByRole('button', { name: 'That’s where they’ll live' }));

    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(router.state.location.pathname).toBe('/onboarding/6');
    expect(useOnboarding.getState().spaceTypes).toEqual(['balcony', 'indoors']);
    expect(event(calls, 'onboarding_step_completed')).toMatchObject({
      properties: { step: 2, space_types: ['balcony', 'indoors'] },
    });
  });

  it('shows the saved answer when coming back', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    // renderAt resets the store, so navigate there after rendering another screen.
    const router = renderAt('/onboarding/1');
    useOnboarding.setState({ spaceTypes: ['unknown'] });
    await router.navigate('/onboarding/2');
    await screen.findByRole('heading', { name: 'Where will your plants live?' });
    expect(tile(/^Not sure yet/)).toHaveAttribute('aria-pressed', 'true');
    expect(tile(/^Balcony/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Skip for now" uses the default and goes to Save your garden', async () => {
    const { calls, router } = await atStep2();
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(router.state.location.pathname).toBe('/onboarding/6');
    expect(useOnboarding.getState().spaceTypes).toEqual(['balcony']);
    expect(event(calls, 'onboarding_skipped')).toMatchObject({ properties: { step: 2 } });
    expect(event(calls, 'onboarding_step_completed')).toBeUndefined();
  });

  it('goes back to Welcome', async () => {
    const { router } = await atStep2();
    await userEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Keep your first plants alive' });
    expect(router.state.location.pathname).toBe('/onboarding/1');
  });

  it('signed-in users get no back button and continue to the next question', async () => {
    const { router } = await atStep2({
      token: 't',
      userId: 'u',
      onboardingStep: 1,
      onboardingDone: false,
    });
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'That’s where they’ll live' }));
    await screen.findByRole('heading', { name: 'Onboarding step 3' });
    expect(router.state.location.pathname).toBe('/onboarding/3');
  });

  it('sends users who finished onboarding to the dashboard', async () => {
    const router = renderAt('/onboarding/2', {
      token: 't',
      userId: 'u',
      onboardingStep: 7,
      onboardingDone: true,
    });
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(router.state.location.pathname).toBe('/dashboard');
  });
});
