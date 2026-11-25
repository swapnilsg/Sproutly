import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useAuth } from '../../stores/auth';
import { useOnboarding } from '../../stores/onboarding';
import { mockApi, renderAt } from '../../test/utils';

type Call = { path: string; body: unknown };
const event = (calls: Call[], name: string) =>
  calls.find((c) => (c.body as { event_name?: string })?.event_name === name)?.body;

const session = { token: 't', userId: 'u', onboardingStep: 0, onboardingDone: false };
const herbs = {
  spaceTypes: ['balcony'] as const,
  sunlight: 'some' as const,
  packId: 'herbs',
  packChosenFor: 'balcony|some',
};

/** Renders step 5 with earlier answers in place (renderAt resets the store first). */
async function atStep5(
  answers: Partial<ReturnType<typeof useOnboarding.getState>> = {},
  opts: { signedIn?: boolean; handlers?: Parameters<typeof mockApi>[0] } = {},
) {
  const api = mockApi({ '/analytics/events': () => ({ status: 202 }), ...opts.handlers });
  const router = renderAt('/onboarding/2', opts.signedIn ? session : null);
  useOnboarding.setState({ ...herbs, ...answers } as never);
  await router.navigate('/onboarding/5');
  await screen.findByRole('heading', { level: 1, name: /^Say hi to your/ });
  return { ...api, router };
}

const ownership = (name: RegExp) => screen.getByRole('radio', { name });
const saveButton = () => screen.getByRole('button', { name: 'Save my garden' });

describe('Step 5 — meet your plant', () => {
  it('introduces the first plant of the pack with its care chips', async () => {
    await atStep5();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Say hi to your basil!');
    expect(screen.getByText('Water every 2 days')).toBeVisible();
    expect(screen.getByText('Loves bright light')).toBeVisible();
    expect(screen.getByText('Beginner friendly')).toBeVisible();
    expect(screen.getByText('Mint and chives are in your garden too.')).toBeVisible();
    expect(screen.getByText('4 of 5')).toBeVisible();
  });

  it('uses the first hand-picked plant when plants were chosen instead of a pack', async () => {
    await atStep5({ packId: null, packChosenFor: null, customPlantIds: ['zz-plant'] });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Say hi to your ZZ plant!');
    expect(screen.queryByText(/in your garden too/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Do you have this plant yet?' })).toBeVisible();
  });

  it('has no default answer: "Save my garden" waits for one', async () => {
    await atStep5();
    expect(ownership(/^Yes, they’re here/)).not.toBeChecked();
    expect(ownership(/^Not yet/)).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Answer above to continue' })).toBeDisabled();
    await userEvent.click(ownership(/^Not yet/));
    expect(saveButton()).toBeEnabled();
  });

  it('saves a nickname on Enter, and Esc cancels an edit', async () => {
    await atStep5();
    await userEvent.click(screen.getByRole('button', { name: 'Tap to give it a nickname' }));
    await userEvent.type(screen.getByLabelText('Nickname'), 'Basil Brush{Enter}');
    expect(screen.getByText('Basil Brush')).toBeVisible();
    expect(useOnboarding.getState().firstPlantNickname).toEqual({
      plantId: 'basil',
      nickname: 'Basil Brush',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Basil · edit nickname' }));
    await userEvent.type(screen.getByLabelText('Nickname'), ' the Great{Escape}');
    expect(screen.getByText('Basil Brush')).toBeVisible();
    expect(useOnboarding.getState().firstPlantNickname?.nickname).toBe('Basil Brush');
  });

  it('caps the nickname at 32 characters', async () => {
    await atStep5();
    await userEvent.click(screen.getByRole('button', { name: 'Tap to give it a nickname' }));
    expect(screen.getByLabelText('Nickname')).toHaveAttribute('maxLength', '32');
  });

  it('guests continue to Save your garden with the answer stored', async () => {
    const { calls, router } = await atStep5();
    await userEvent.click(ownership(/^Yes, they’re here/));
    await userEvent.click(saveButton());
    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(router.state.location.pathname).toBe('/onboarding/6');
    expect(useOnboarding.getState().plantsOwned).toBe(true);
    expect(event(calls, 'onboarding_step_completed')).toMatchObject({
      properties: { step: 5, plants_owned: true, has_nickname: false },
    });
  });

  it('signed-in users have their garden saved and move on to step 7', async () => {
    const { calls, router } = await atStep5(
      { firstPlantNickname: { plantId: 'basil', nickname: 'Basil Brush' } },
      { signedIn: true, handlers: { '/onboarding/setup': () => ({ status: 201, body: {} }) } },
    );
    await userEvent.click(ownership(/^Not yet/));
    await userEvent.click(saveButton());
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding/7'));
    expect(calls.find((c) => c.path === '/onboarding/setup')?.body).toMatchObject({
      space_types: ['balcony'],
      sunlight: 'some',
      pack_id: 'herbs',
      custom_plant_ids: null,
      first_plant_nickname: 'Basil Brush',
      plants_owned: false,
      timezone: expect.any(String),
    });
    expect(useAuth.getState().session?.onboardingStep).toBe(6);
    expect(useOnboarding.getState().spaceTypes).toBeNull(); // answers cleared once saved
  });

  it('a returning user whose garden already exists is sent home quietly', async () => {
    const { router } = await atStep5(
      {},
      {
        signedIn: true,
        handlers: {
          '/onboarding/setup': () => ({ status: 409, body: { error: 'garden_exists' } }),
          '/auth/refresh': () => ({
            status: 200,
            body: { token: 't2', user_id: 'u', onboarding_step: 7, onboarding_done: true },
          }),
        },
      },
    );
    await userEvent.click(ownership(/^Yes/));
    await userEvent.click(saveButton());
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a friendly error and keeps the answers if saving fails', async () => {
    await atStep5(
      {},
      {
        signedIn: true,
        handlers: {
          '/onboarding/setup': () => ({ status: 500, body: { error: 'internal_error' } }),
        },
      },
    );
    await userEvent.click(ownership(/^Yes/));
    await userEvent.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong — try again.');
    expect(useOnboarding.getState().packId).toBe('herbs');
    expect(saveButton()).toBeEnabled();
  });

  it('"Skip for now" assumes "not yet" and jumps to Save your garden', async () => {
    const { router } = await atStep5();
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(router.state.location.pathname).toBe('/onboarding/6');
    expect(useOnboarding.getState().plantsOwned).toBe(false);
  });

  it('a nickname given to one plant does not follow the user to another pack', async () => {
    await atStep5({
      packId: 'houseplants',
      packChosenFor: 'balcony|some',
      firstPlantNickname: { plantId: 'basil', nickname: 'Basil Brush' },
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Say hi to your pothos!');
    expect(screen.queryByText('Basil Brush')).toBeNull();
  });

  it('goes back to step 4', async () => {
    const { router } = await atStep5();
    await userEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Start with a bundle?' });
    expect(router.state.location.pathname).toBe('/onboarding/4');
  });
});

describe('Skipping as a signed-in user', () => {
  it('saves the garden with defaults straight from step 2', async () => {
    const { calls } = mockApi({
      '/analytics/events': () => ({ status: 202 }),
      '/onboarding/setup': () => ({ status: 201, body: {} }),
    });
    const router = renderAt('/onboarding/2', session);
    await userEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding/7'));
    expect(calls.find((c) => c.path === '/onboarding/setup')?.body).toMatchObject({
      space_types: ['balcony'],
      sunlight: 'unknown',
      pack_id: 'herbs',
      plants_owned: false,
    });
  });
});
