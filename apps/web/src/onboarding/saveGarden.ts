import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, apiFetch, friendlyError } from '../lib/api';
import { homeRoute, useAuth } from '../stores/auth';
import { useOnboarding } from '../stores/onboarding';
import { buildSetupBody } from './answers';

const SAVE_GARDEN_ROUTE = '/onboarding/6';
export const AFTER_SETUP_ROUTE = '/onboarding/7';

/**
 * Sends the step 2–5 answers to POST /onboarding/setup.
 * 'saved': garden created, local answers cleared. 'exists': the account already has a garden
 * (a returning user who went through the questions again); local answers are dropped.
 */
export async function saveGarden(token?: string): Promise<'saved' | 'exists'> {
  try {
    await apiFetch('/onboarding/setup', {
      method: 'POST',
      body: buildSetupBody(useOnboarding.getState()),
      token,
    });
    useOnboarding.getState().reset();
    return 'saved';
  } catch (err) {
    if (err instanceof ApiError && err.code === 'garden_exists') {
      useOnboarding.getState().reset();
      return 'exists';
    }
    throw err;
  }
}

/**
 * The one way out of the question steps (step 5's CTA and every "Skip for now"):
 * guests go to Save your garden (sign-up); signed-in users have their garden saved right away.
 */
export function useFinishQuestions() {
  const navigate = useNavigate();
  const signedIn = useAuth((s) => s.session !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    if (!signedIn) {
      navigate(SAVE_GARDEN_ROUTE);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await saveGarden();
      if (result === 'saved') {
        useAuth.getState().setProgress(6);
        navigate(AFTER_SETUP_ROUTE, { replace: true });
      } else {
        // The server is ahead of this tab; fetch the real progress before routing.
        await useAuth.getState().refresh();
        const session = useAuth.getState().session;
        navigate(session ? homeRoute(session) : '/onboarding/1', { replace: true });
      }
    } catch (err) {
      setError(friendlyError(err));
      setSaving(false);
    }
  }

  return { finish, saving, error };
}
