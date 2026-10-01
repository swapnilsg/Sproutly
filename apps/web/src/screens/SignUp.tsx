import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { GOOGLE_CLIENT_ID, GoogleButton } from '../components/GoogleButton';
import { TextField } from '../components/TextField';
import { track } from '../lib/analytics';
import { apiFetch, friendlyError } from '../lib/api';
import { homeRoute, useAuth, type SessionResponse } from '../stores/auth';
import { useOnboarding } from '../stores/onboarding';
import { AuthLayout } from './AuthLayout';
import { AUTH_MODES, type AuthMode } from './authMode';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Called by both sign-in methods once a session exists. */
export function useCompleteSignIn(mode: AuthMode) {
  const navigate = useNavigate();
  return (res: SessionResponse, method: 'google' | 'email') => {
    const { step1StartedAt, reset } = useOnboarding.getState();
    useAuth.getState().setSession(res);
    // Saving the garden is onboarding step 6. A returning user signing in completes no step,
    // unless they turn out to be new.
    if (mode === 'save' || res.is_new_user) {
      track('onboarding_step_completed', {
        step: 6,
        method,
        is_new_user: res.is_new_user,
        time_on_step: step1StartedAt ? Date.now() - step1StartedAt : undefined,
      });
    }
    navigate(homeRoute(useAuth.getState().session!), { replace: true });
    reset();
  };
}

export function SignUp({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const completeSignIn = useCompleteSignIn(mode);
  const { base, title, sub } = AUTH_MODES[mode];
  const { pendingEmail, setPendingEmail } = useOnboarding();
  const [email, setEmail] = useState(pendingEmail ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  function validate(value: string) {
    return EMAIL_PATTERN.test(value.trim()) ? null : 'Enter a valid email address';
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const error = validate(email);
    setFieldError(error);
    setFormError(null);
    if (error) return;

    const normalized = email.trim().toLowerCase();
    setSending(true);
    try {
      await apiFetch('/auth/email/start', {
        method: 'POST',
        body: { email: normalized },
        auth: false,
      });
      setPendingEmail(normalized);
      navigate(`${base}/code`);
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setSending(false);
    }
  }

  async function onGoogleCredential(credential: string) {
    setFormError(null);
    setGoogleBusy(true);
    try {
      const res = await apiFetch<SessionResponse>('/auth/google', {
        method: 'POST',
        body: { credential },
        auth: false,
      });
      completeSignIn(res, 'google');
    } catch (err) {
      setFormError(friendlyError(err));
      setGoogleBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">{title}</h1>
      <p className="auth-sub">{sub}</p>

      {GOOGLE_CLIENT_ID ? (
        <>
          <div aria-busy={googleBusy || undefined}>
            <GoogleButton onCredential={onGoogleCredential} />
          </div>
          <div className="divider" role="separator">
            <span>or</span>
          </div>
        </>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldError) setFieldError(null);
          }}
          onBlur={() => email && setFieldError(validate(email))}
          error={fieldError}
          hint="We'll email you a 6-digit code — no password needed."
        />
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <Button type="submit" loading={sending}>
          Continue with email
        </Button>
      </form>
    </AuthLayout>
  );
}
