import { create } from 'zustand';
import { firstUnansweredStep } from '../onboarding/answers';
import { useOnboarding } from './onboarding';

export interface Session {
  token: string;
  userId: string;
  onboardingStep: number;
  onboardingDone: boolean;
}

/** Shape shared by /auth/email/verify, /auth/google and /auth/refresh. */
export interface SessionResponse {
  token: string;
  user_id: string;
  onboarding_step: number;
  onboarding_done: boolean;
  is_new_user?: boolean;
}

interface AuthState {
  status: 'loading' | 'signed_in' | 'signed_out';
  /** Access token lives in memory only; the refresh token is an httpOnly cookie. */
  session: Session | null;
  setSession(res: SessionResponse): void;
  /** Records onboarding progress the server has confirmed (only ever moves forward). */
  setProgress(step: number): void;
  /** Exchanges the refresh cookie for a new access token. Resolves false when signed out. */
  refresh(): Promise<boolean>;
  logout(): Promise<void>;
}

let inflightRefresh: Promise<boolean> | null = null;

export const useAuth = create<AuthState>()((set, get) => ({
  status: 'loading',
  session: null,

  setProgress(step) {
    const session = get().session;
    if (session && step > session.onboardingStep) {
      set({ session: { ...session, onboardingStep: step } });
    }
  },

  setSession(res) {
    set({
      status: 'signed_in',
      session: {
        token: res.token,
        userId: res.user_id,
        onboardingStep: res.onboarding_step,
        onboardingDone: res.onboarding_done,
      },
    });
  },

  refresh() {
    // Collapse concurrent refreshes into one request so the cookie is only rotated once.
    inflightRefresh ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          set({ status: 'signed_out', session: null });
          return false;
        }
        get().setSession(await res.json());
        return true;
      })
      .catch(() => {
        set({ status: 'signed_out', session: null });
        return false;
      })
      .finally(() => {
        inflightRefresh = null;
      });
    return inflightRefresh;
  },

  async logout() {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    set({ status: 'signed_out', session: null });
  },
}));

/** Where a signed-in user belongs: their next onboarding step, or the dashboard. */
export function homeRoute(session: Session): string {
  if (session.onboardingDone) return '/dashboard';
  // No garden yet: resume the questions where this browser's answers stop.
  if (session.onboardingStep < 6) {
    return `/onboarding/${firstUnansweredStep(useOnboarding.getState())}`;
  }
  return `/onboarding/${Math.min(session.onboardingStep + 1, 8)}`;
}
