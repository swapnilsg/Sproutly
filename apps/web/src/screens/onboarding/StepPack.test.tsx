import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useOnboarding } from '../../stores/onboarding';
import { mockApi, renderAt } from '../../test/utils';

type Call = { path: string; body: unknown };
const event = (calls: Call[], name: string) =>
  calls.find((c) => (c.body as { event_name?: string })?.event_name === name)?.body;

/** Renders step 4 with earlier answers in place (renderAt resets the store first). */
async function atStep4(
  answers: Partial<ReturnType<typeof useOnboarding.getState>> = {},
  handlers: Parameters<typeof mockApi>[0] = {},
) {
  const api = mockApi({ '/analytics/events': () => ({ status: 202 }), ...handlers });
  const router = renderAt('/onboarding/1');
  useOnboarding.setState(answers);
  await router.navigate('/onboarding/4');
  await screen.findByRole('heading', { name: 'Start with a bundle?' });
  return { ...api, router };
}

const packRadio = (name: RegExp) => screen.getByRole('radio', { name });

describe('Step 4 — pick your starter pack', () => {
  it('recommends herbs for a balcony and lists it first with a badge', async () => {
    await atStep4({ spaceTypes: ['balcony'], sunlight: 'some' });
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAccessibleName(/^Best for your spot\s*Easy balcony herbs/);
    expect(radios[0]).toBeChecked();
    expect(screen.getAllByText('Best for your spot')).toHaveLength(1);
    expect(screen.getByText('3 of 5')).toBeVisible();
  });

  it('recommends houseplants for indoors, and for shade', async () => {
    await atStep4({ spaceTypes: ['indoors'], sunlight: 'bright' });
    expect(packRadio(/Beginner houseplants/)).toBeChecked();
    expect(screen.getAllByRole('radio')[0]).toHaveAccessibleName(/Beginner houseplants/);
  });

  it('warns when a pack needs more sun than the spot gets', async () => {
    await atStep4({ spaceTypes: ['balcony'], sunlight: 'shade' });
    expect(packRadio(/Balcony flowers/)).toHaveAccessibleName(/Needs more sun than your spot gets/);
    expect(packRadio(/Easy balcony herbs/)).toHaveAccessibleName(
      /Needs more sun than your spot gets/,
    );
    expect(packRadio(/Beginner houseplants/)).not.toHaveAccessibleName(/Needs more sun/);
  });

  it('saves the chosen pack, tracks it and continues to Save your garden', async () => {
    const { calls, router } = await atStep4({ spaceTypes: ['balcony'], sunlight: 'bright' });
    await userEvent.click(packRadio(/Balcony flowers/));
    await userEvent.click(screen.getByRole('button', { name: 'Add these to my garden' }));

    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(router.state.location.pathname).toBe('/onboarding/6');
    expect(useOnboarding.getState()).toMatchObject({ packId: 'flowers', customPlantIds: [] });
    expect(event(calls, 'starter_pack_selected')).toMatchObject({
      properties: { pack_id: 'flowers', pack_name: 'Balcony flowers', recommended: false },
    });
    expect(event(calls, 'onboarding_step_completed')).toMatchObject({ properties: { step: 4 } });
  });

  it('offers only plants that suit the light', async () => {
    await atStep4({ spaceTypes: ['balcony'], sunlight: 'shade' });
    await userEvent.click(screen.getByRole('button', { name: 'Choose my own plants' }));
    const group = screen.getByRole('group', { name: 'Choose up to 5 plants' });
    expect(within(group).queryByRole('checkbox', { name: /Basil/ })).toBeNull();
    expect(within(group).getByRole('checkbox', { name: /Pothos/ })).toBeVisible();
  });

  it('lets you choose up to 5 plants instead of a pack', async () => {
    const { calls } = await atStep4({ spaceTypes: ['balcony'], sunlight: 'unknown' });
    await userEvent.click(screen.getByRole('button', { name: 'Choose my own plants' }));
    const group = screen.getByRole('group', { name: 'Choose up to 5 plants' });
    const boxes = within(group).getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(5);

    expect(screen.getByRole('button', { name: 'Pick at least one plant' })).toBeDisabled();
    for (const box of boxes.slice(0, 5)) await userEvent.click(box);
    expect(screen.getByText('5 of 5 chosen')).toBeVisible();
    expect(boxes[5]).toBeDisabled();
    await userEvent.click(boxes[0]!);
    expect(boxes[5]).toBeEnabled();
    await userEvent.click(boxes[0]!);

    await userEvent.click(screen.getByRole('button', { name: 'Add these to my garden' }));
    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(useOnboarding.getState().customPlantIds).toHaveLength(5);
    expect(useOnboarding.getState().packId).toBeNull();
    expect(event(calls, 'starter_pack_selected')).toMatchObject({
      properties: { custom: true, count: 5 },
    });
  });

  it('can go back from the picker to the bundles', async () => {
    await atStep4();
    await userEvent.click(screen.getByRole('button', { name: 'Choose my own plants' }));
    await userEvent.click(screen.getByRole('button', { name: 'Use a bundle instead' }));
    expect(screen.getByRole('radiogroup', { name: 'Start with a bundle?' })).toBeVisible();
  });

  it('shows the guessed city and lets you change it', async () => {
    await atStep4({
      location: { raw: 'Bengaluru', city: 'Bengaluru', countryCode: 'IN', source: 'ip' },
    });
    expect(screen.getByText('Bengaluru')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Change city' }));
    const input = screen.getByLabelText('City');
    expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.type(input, 'Pune{Enter}');
    expect(screen.getByText('Pune')).toBeVisible();
    expect(useOnboarding.getState().location).toEqual({
      raw: 'Pune',
      city: 'Pune',
      countryCode: null,
      source: 'user',
    });
  });

  it('offers "Add your city (optional)" when there is no guess', async () => {
    await atStep4();
    await userEvent.click(screen.getByRole('button', { name: 'Add your city (optional)' }));
    await userEvent.type(screen.getByLabelText('City'), 'Mumbai');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Mumbai')).toBeVisible();
  });

  it('fills in the guessed city in the background', async () => {
    await atStep4(
      { cityGuessed: false },
      {
        '/geo/guess': () => ({ status: 200, body: { city: 'Bengaluru', country_code: 'IN' } }),
      },
    );
    await waitFor(() => expect(screen.getByText('Bengaluru')).toBeVisible());
    expect(useOnboarding.getState().location?.source).toBe('ip');
  });

  it('"Skip for now" picks the recommended pack and jumps to Save your garden', async () => {
    const { router } = await atStep4({ spaceTypes: ['indoors'], sunlight: 'some' });
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(router.state.location.pathname).toBe('/onboarding/6');
    expect(useOnboarding.getState().packId).toBe('houseplants');
  });

  it('ignores a pack that "Skip for now" filled in once real answers arrive', async () => {
    // Skipped on step 2 (herbs filled in), then answered Indoors + Mostly shade.
    await atStep4({
      spaceTypes: ['indoors'],
      sunlight: 'shade',
      packId: 'herbs',
      packChosenFor: null,
    });
    expect(packRadio(/Beginner houseplants/)).toBeChecked();
    expect(packRadio(/Easy balcony herbs/)).not.toBeChecked();
  });

  it('keeps a pack the user chose while their answers stay the same', async () => {
    await atStep4({
      spaceTypes: ['balcony'],
      sunlight: 'bright',
      packId: 'flowers',
      packChosenFor: 'balcony|bright',
    });
    expect(packRadio(/Balcony flowers/)).toBeChecked();
  });

  it('recommends afresh after the sunlight answer changes', async () => {
    // Chose flowers for a bright balcony, went back and changed sunlight to shade.
    await atStep4({
      spaceTypes: ['balcony'],
      sunlight: 'shade',
      packId: 'flowers',
      packChosenFor: 'balcony|bright',
    });
    expect(packRadio(/Beginner houseplants/)).toBeChecked();
  });

  it('"Skip for now" replaces a stale skip-filled pack with the current recommendation', async () => {
    await atStep4({
      spaceTypes: ['indoors'],
      sunlight: 'shade',
      packId: 'herbs',
      packChosenFor: null,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(useOnboarding.getState().packId).toBe('houseplants');
  });

  it('records which answers a chosen pack belongs to', async () => {
    await atStep4({ spaceTypes: ['indoors', 'balcony'], sunlight: 'some' });
    await userEvent.click(packRadio(/Balcony flowers/));
    await userEvent.click(screen.getByRole('button', { name: 'Add these to my garden' }));
    await screen.findByRole('heading', { name: 'Your garden is ready 🌱' });
    expect(useOnboarding.getState()).toMatchObject({
      packId: 'flowers',
      packChosenFor: 'balcony,indoors|some',
    });
  });

  it('goes back to step 3', async () => {
    const { router } = await atStep4();
    await userEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'How sunny is that spot?' });
    expect(router.state.location.pathname).toBe('/onboarding/3');
  });
});
