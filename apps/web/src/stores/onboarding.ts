import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { recommendPack } from '@sproutly/catalogue';
import { answersKey, STEP_DEFAULTS, type SpaceType, type Sunlight } from '../onboarding/flow';

/** Where the user grows: guessed from their IP address, or typed in on step 4. */
export interface GardenLocation {
  raw: string;
  city: string | null;
  countryCode: string | null;
  source: 'ip' | 'user';
}

interface OnboardingState {
  /** Email waiting for its sign-in code; survives a refresh on the code screen. */
  pendingEmail: string | null;
  /** When step 1 was first shown, for time_on_step analytics. */
  step1StartedAt: number | null;
  /**
   * Step 2 answer, kept in the browser until setup saves it to the server.
   * null means not answered yet (the screen shows the default).
   */
  spaceTypes: SpaceType[] | null;
  /** Step 3 answer (same rules as spaceTypes). */
  sunlight: Sunlight | null;
  /** Step 4 answer: a starter pack, or (instead) up to 5 hand-picked plants. */
  packId: string | null;
  customPlantIds: string[];
  /**
   * `answersKey()` of the step 2–3 answers the user picked `packId` for on step 4.
   * null when the pack was filled in by "Skip for now" rather than chosen.
   */
  packChosenFor: string | null;
  /** Step 4's optional city. */
  location: GardenLocation | null;
  /** The IP city guess runs once per onboarding attempt, so it never overrides an edit. */
  cityGuessed: boolean;
  /** Step 5: nickname for the first plant (kept with its plant, so it can't stick to another). */
  firstPlantNickname: { plantId: string; nickname: string } | null;
  /** Step 5: does the user already have the plants? null = not answered (there is no default). */
  plantsOwned: boolean | null;
  setPendingEmail(email: string | null): void;
  /** Records the step 1 start time; returns true only the first time (per onboarding attempt). */
  markStep1Started(): boolean;
  setSpaceTypes(spaceTypes: SpaceType[]): void;
  setSunlight(sunlight: Sunlight): void;
  /** The user's own pack choice on step 4, for the current step 2–3 answers. */
  setPack(packId: string): void;
  setCustomPlants(plantIds: string[]): void;
  /** The user's own city edit; also stops any pending IP guess from overwriting it. */
  setLocation(location: GardenLocation | null): void;
  setCityGuessed(): void;
  setFirstPlantNickname(value: { plantId: string; nickname: string } | null): void;
  setPlantsOwned(owned: boolean): void;
  /** "Skip for now": fill every unanswered question with its default. */
  fillDefaults(): void;
  reset(): void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      pendingEmail: null,
      step1StartedAt: null,
      spaceTypes: null,
      sunlight: null,
      packId: null,
      customPlantIds: [],
      packChosenFor: null,
      location: null,
      cityGuessed: false,
      firstPlantNickname: null,
      plantsOwned: null,
      setPendingEmail: (pendingEmail) => set({ pendingEmail }),
      setSpaceTypes: (spaceTypes) => set({ spaceTypes }),
      setSunlight: (sunlight) => set({ sunlight }),
      setPack: (packId) =>
        set((s) => ({
          packId,
          customPlantIds: [],
          packChosenFor: answersKey(
            s.spaceTypes ?? STEP_DEFAULTS.spaceTypes,
            s.sunlight ?? STEP_DEFAULTS.sunlight,
          ),
        })),
      setCustomPlants: (customPlantIds) =>
        set({ customPlantIds, packId: null, packChosenFor: null }),
      setLocation: (location) => set({ location, cityGuessed: true }),
      setCityGuessed: () => set({ cityGuessed: true }),
      setFirstPlantNickname: (firstPlantNickname) => set({ firstPlantNickname }),
      setPlantsOwned: (plantsOwned) => set({ plantsOwned }),
      fillDefaults: () =>
        set((s) => {
          const spaceTypes = s.spaceTypes ?? STEP_DEFAULTS.spaceTypes;
          const sunlight = s.sunlight ?? STEP_DEFAULTS.sunlight;
          // Hand-picked plants are always the user's own choice. A pack only counts as chosen
          // if it was picked for these exact answers; otherwise use today's recommendation.
          const keepChoice =
            s.customPlantIds.length > 0 ||
            (s.packId !== null && s.packChosenFor === answersKey(spaceTypes, sunlight));
          // Step 5 has no default on screen; skipping assumes "not yet" (the harmless option).
          const plantsOwned = s.plantsOwned ?? false;
          return keepChoice
            ? { spaceTypes, sunlight, plantsOwned }
            : {
                spaceTypes,
                sunlight,
                plantsOwned,
                packId: recommendPack(spaceTypes, sunlight).id,
                customPlantIds: [],
                packChosenFor: null,
              };
        }),
      markStep1Started: () => {
        if (get().step1StartedAt) return false;
        set({ step1StartedAt: Date.now() });
        return true;
      },
      reset: () =>
        set({
          pendingEmail: null,
          step1StartedAt: null,
          spaceTypes: null,
          sunlight: null,
          packId: null,
          customPlantIds: [],
          packChosenFor: null,
          location: null,
          cityGuessed: false,
          firstPlantNickname: null,
          plantsOwned: null,
        }),
    }),
    {
      name: 'sproutly_onboarding_v1',
      // Falls back to memory when storage is unavailable (private mode, blocked cookies).
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
