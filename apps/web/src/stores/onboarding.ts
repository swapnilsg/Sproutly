import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface OnboardingState {
  /** Email waiting for its sign-in code; survives a refresh on the code screen. */
  pendingEmail: string | null;
  /** When step 1 was first shown, for time_on_step analytics. */
  step1StartedAt: number | null;
  setPendingEmail(email: string | null): void;
  /** Records the step 1 start time; returns true only the first time (per onboarding attempt). */
  markStep1Started(): boolean;
  reset(): void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      pendingEmail: null,
      step1StartedAt: null,
      setPendingEmail: (pendingEmail) => set({ pendingEmail }),
      markStep1Started: () => {
        if (get().step1StartedAt) return false;
        set({ step1StartedAt: Date.now() });
        return true;
      },
      reset: () => set({ pendingEmail: null, step1StartedAt: null }),
    }),
    {
      name: 'sproutly_onboarding_v1',
      // Falls back to memory when storage is unavailable (private mode, blocked cookies).
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
