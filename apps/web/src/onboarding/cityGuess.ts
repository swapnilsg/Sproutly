import { useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useOnboarding } from '../stores/onboarding';

let inflight: Promise<void> | null = null;

/**
 * Guesses the user's city once per onboarding attempt (spec step 4), in the background.
 * Never blocks a screen, never overrides a city the user typed, and failures are silent.
 */
export function prefetchCityGuess(): Promise<void> {
  if (useOnboarding.getState().cityGuessed) return Promise.resolve();
  inflight ??= apiFetch<{ city: string | null; country_code?: string | null }>('/geo/guess', {
    auth: false,
  })
    .then((guess) => {
      const store = useOnboarding.getState();
      // The user may have typed or cleared a city while the guess was in flight (that marks
      // cityGuessed); their answer wins, including "no city".
      if (store.cityGuessed) return;
      if (guess.city && !store.location) {
        store.setLocation({
          raw: guess.city,
          city: guess.city,
          countryCode: guess.country_code ?? null,
          source: 'ip',
        });
      }
      store.setCityGuessed();
    })
    .catch(() => {
      // Offline or blocked: the chip just offers "Add your city (optional)".
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Starts the city guess when a question step mounts (steps 2–4). */
export function useCityGuess() {
  useEffect(() => {
    void prefetchCityGuess();
  }, []);
}
