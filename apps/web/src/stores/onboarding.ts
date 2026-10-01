import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { STEP_DEFAULTS, type SpaceType, type Sunlight } from '../onboarding/flow';

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
  setPendingEmail(email: string | null): void;
  /** Records the step 1 start time; returns true only the first time (per onboarding attempt). */
  markStep1Started(): boolean;
  setSpaceTypes(spaceTypes: SpaceType[]): void;
  setSunlight(sunlight: Sunlight): void;
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
      setPendingEmail: (pendingEmail) => set({ pendingEmail }),
      setSpaceTypes: (spaceTypes) => set({ spaceTypes }),
      setSunlight: (sunlight) => set({ sunlight }),
      fillDefaults: () =>
        set((s) => ({
          spaceTypes: s.spaceTypes ?? STEP_DEFAULTS.spaceTypes,
          sunlight: s.sunlight ?? STEP_DEFAULTS.sunlight,
        })),
      markStep1Started: () => {
        if (get().step1StartedAt) return false;
        set({ step1StartedAt: Date.now() });
        return true;
      },
      reset: () =>
        set({ pendingEmail: null, step1StartedAt: null, spaceTypes: null, sunlight: null }),
    }),
    {
      name: 'sproutly_onboarding_v1',
      // Falls back to memory when storage is unavailable (private mode, blocked cookies).
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
