import { getPack, getPlant, recommendPack, type Plant } from '@sproutly/catalogue';
import type { useOnboarding } from '../stores/onboarding';
import { answersKey, STEP_DEFAULTS } from './flow';

type OnboardingAnswers = Pick<
  ReturnType<typeof useOnboarding.getState>,
  | 'spaceTypes'
  | 'sunlight'
  | 'packId'
  | 'customPlantIds'
  | 'packChosenFor'
  | 'location'
  | 'firstPlantNickname'
  | 'plantsOwned'
>;

/**
 * The plants the garden will start with: hand-picked plants, else the pack the user chose for
 * their current answers, else the recommendation (same rules as step 4 and "Skip for now").
 */
export function resolveGardenPlants(s: OnboardingAnswers): {
  packId: string | null;
  plants: Plant[];
} {
  if (s.customPlantIds.length > 0) {
    return { packId: null, plants: s.customPlantIds.map((id) => getPlant(id)!).filter(Boolean) };
  }
  const spaceTypes = s.spaceTypes ?? STEP_DEFAULTS.spaceTypes;
  const sunlight = s.sunlight ?? STEP_DEFAULTS.sunlight;
  const chosen =
    s.packId && s.packChosenFor === answersKey(spaceTypes, sunlight)
      ? getPack(s.packId)
      : undefined;
  const pack = chosen ?? recommendPack(spaceTypes, sunlight);
  return { packId: pack.id, plants: pack.plantIds.map((id) => getPlant(id)!) };
}

/**
 * Where a signed-in account without a garden should resume: the first question this browser
 * has no answer for, or step 5 ("Save my garden") once everything is answered.
 */
export function firstUnansweredStep(s: OnboardingAnswers): number {
  if (s.spaceTypes === null) return 2;
  if (s.sunlight === null) return 3;
  if (s.packId === null && s.customPlantIds.length === 0) return 4;
  return 5;
}

/** True once steps 2–5 are all answered, so the garden can be saved without asking anything else. */
export function answersComplete(s: OnboardingAnswers): boolean {
  return s.spaceTypes !== null && s.sunlight !== null && s.plantsOwned !== null;
}

/** The nickname, but only if it still belongs to the garden's first plant. */
export function firstPlantNickname(s: OnboardingAnswers): string | null {
  const first = resolveGardenPlants(s).plants[0];
  return s.firstPlantNickname && first && s.firstPlantNickname.plantId === first.id
    ? s.firstPlantNickname.nickname
    : null;
}

/** Body for POST /onboarding/setup. */
export function buildSetupBody(s: OnboardingAnswers) {
  const { packId, plants } = resolveGardenPlants(s);
  return {
    space_types: s.spaceTypes ?? STEP_DEFAULTS.spaceTypes,
    sunlight: s.sunlight ?? STEP_DEFAULTS.sunlight,
    pack_id: packId,
    custom_plant_ids: packId ? null : plants.map((p) => p.id),
    first_plant_nickname: firstPlantNickname(s),
    plants_owned: s.plantsOwned ?? false,
    location: s.location
      ? {
          raw: s.location.raw,
          city: s.location.city,
          country_code: s.location.countryCode,
          source: s.location.source,
        }
      : null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}
