import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useOnboarding } from '../../stores/onboarding';
import { mockApi, renderAt } from '../../test/utils';

type Call = { path: string; body: unknown };
const event = (calls: Call[], name: string) =>
  calls.find((c) => (c.body as { event_name?: string })?.event_name === name)?.body;

async function atStep3(session: Parameters<typeof renderAt>[1] = null) {
  const api = mockApi({ '/analytics/events': () => ({ status: 202 }) });
  const router = renderAt('/onboarding/3', session);
  await screen.findByRole('heading', { name: 'How sunny is that spot?' });
  return { ...api, router };
}

describe('Step 3 — how sunny is that spot?', () => {
  it('pre-selects "Not sure" in a labelled radio group, progress 2 of 5', async () => {
    await atStep3();
    expect(screen.getByRole('radiogroup', { name: 'How sunny is that spot?' })).toBeVisible();
    expect(screen.getByRole('radio', { name: /^Not sure/ })).toBeChecked();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByText('2 of 5')).toBeVisible();
  });

  it('saves the choice, tracks it and continues to Save your garden', async () => {
    const { calls, router } = await atStep3();
    await userEvent.click(screen.getByRole('radio', { name: /^Bright sun/ }));
    expect(screen.getByRole('radio', { name: /^Bright sun/ })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Show me plants that fit' }));

    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(router.state.location.pathname).toBe('/onboarding/6');
    expect(useOnboarding.getState().sunlight).toBe('bright');
    expect(event(calls, 'onboarding_step_completed')).toMatchObject({
      properties: { step: 3, sunlight: 'bright' },
    });
  });

  it('arrow keys move the choice', async () => {
    await atStep3();
    screen.getByRole('radio', { name: /^Not sure/ }).focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: /^Mostly shade/ })).toBeChecked();
  });

  it('shows the saved answer when coming back', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = renderAt('/onboarding/2');
    useOnboarding.setState({ sunlight: 'shade' });
    await router.navigate('/onboarding/3');
    await screen.findByRole('heading', { name: 'How sunny is that spot?' });
    expect(screen.getByRole('radio', { name: /^Mostly shade/ })).toBeChecked();
  });

  it('"Skip for now" keeps earlier answers, fills the rest and jumps to Save your garden', async () => {
    mockApi({ '/analytics/events': () => ({ status: 202 }) });
    const router = renderAt('/onboarding/2');
    useOnboarding.setState({ spaceTypes: ['indoors'] });
    await router.navigate('/onboarding/3');
    await screen.findByRole('heading', { name: 'How sunny is that spot?' });
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(useOnboarding.getState().spaceTypes).toEqual(['indoors']);
    expect(useOnboarding.getState().sunlight).toBe('unknown');
  });

  it('goes back to step 2, for guests and signed-in users alike', async () => {
    const { router } = await atStep3({
      token: 't',
      userId: 'u',
      onboardingStep: 1,
      onboardingDone: false,
    });
    await userEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Where will your plants live?' });
    expect(router.state.location.pathname).toBe('/onboarding/2');
  });

  it('signed-in users continue to the next question', async () => {
    const { router } = await atStep3({
      token: 't',
      userId: 'u',
      onboardingStep: 1,
      onboardingDone: false,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Show me plants that fit' }));
    await screen.findByRole('heading', { name: 'Onboarding step 4' });
    expect(router.state.location.pathname).toBe('/onboarding/4');
  });
});
