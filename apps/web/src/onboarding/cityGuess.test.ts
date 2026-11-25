import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOnboarding } from '../stores/onboarding';
import { prefetchCityGuess } from './cityGuess';

/** A fetch whose response we release by hand, to model a slow city guess. */
function slowGuess(body: unknown) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      await gate;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return release;
}

describe('prefetchCityGuess', () => {
  afterEach(() => useOnboarding.getState().reset());

  it('fills in the guessed city when the user has not touched it', async () => {
    useOnboarding.getState().reset();
    const release = slowGuess({ city: 'Bengaluru', country_code: 'IN' });
    const done = prefetchCityGuess();
    release();
    await done;
    expect(useOnboarding.getState().location).toEqual({
      raw: 'Bengaluru',
      city: 'Bengaluru',
      countryCode: 'IN',
      source: 'ip',
    });
  });

  it('does not overwrite a city the user cleared while the guess was in flight', async () => {
    useOnboarding.getState().reset();
    const release = slowGuess({ city: 'Bengaluru', country_code: 'IN' });
    const done = prefetchCityGuess();
    useOnboarding.getState().setLocation(null); // "Add your city" → empty → Done
    release();
    await done;
    expect(useOnboarding.getState().location).toBeNull();
  });

  it('does not overwrite a city the user typed while the guess was in flight', async () => {
    useOnboarding.getState().reset();
    const release = slowGuess({ city: 'Bengaluru', country_code: 'IN' });
    const done = prefetchCityGuess();
    useOnboarding
      .getState()
      .setLocation({ raw: 'Pune', city: 'Pune', countryCode: null, source: 'user' });
    release();
    await done;
    expect(useOnboarding.getState().location?.city).toBe('Pune');
  });

  it('only guesses once per onboarding attempt', async () => {
    useOnboarding.getState().reset();
    const release = slowGuess({ city: 'Bengaluru', country_code: 'IN' });
    const first = prefetchCityGuess();
    release();
    await first;
    await prefetchCityGuess();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
