import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { recommendPack } from '@sproutly/catalogue';
import { STEP_DEFAULTS, type SpaceType, type Sunlight } from '../onboarding/flow';

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
  /** Step 4's optional city. */
  location: GardenLocation | null;
  /** The IP city guess runs once per onboarding attempt, so it never overrides an edit. */
  cityGuessed: boolean;
  setPendingEmail(email: string | null): void;
  /** Records the step 1 start time; returns true only the first time (per onboarding attempt). */
  markStep1Started(): boolean;
  setSpaceTypes(spaceTypes: SpaceType[]): void;
  setSunlight(sunlight: Sunlight): void;
  setPack(packId: string): void;
  setCustomPlants(plantIds: string[]): void;
  setLocation(location: GardenLocation | null): void;
  setCityGuessed(): void;
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
      location: null,
      cityGuessed: false,
      setPendingEmail: (pendingEmail) => set({ pendingEmail }),
      setSpaceTypes: (spaceTypes) => set({ spaceTypes }),
      setSunlight: (sunlight) => set({ sunlight }),
      setPack: (packId) => set({ packId, customPlantIds: [] }),
      setCustomPlants: (customPlantIds) => set({ customPlantIds, packId: null }),
      setLocation: (location) => set({ location }),
      setCityGuessed: () => set({ cityGuessed: true }),
      fillDefaults: () =>
        set((s) => {
          const spaceTypes = s.spaceTypes ?? STEP_DEFAULTS.spaceTypes;
          const sunlight = s.sunlight ?? STEP_DEFAULTS.sunlight;
          const hasPlants = s.packId !== null || s.customPlantIds.length > 0;
          return {
            spaceTypes,
            sunlight,
            packId: hasPlants ? s.packId : recommendPack(spaceTypes, sunlight).id,
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
          location: null,
          cityGuessed: false,
        }),
    }),
    {
      name: 'sproutly_onboarding_v1',
      // Falls back to memory when storage is unavailable (private mode, blocked cookies).
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
