import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { ApiError, apiFetch, friendlyError } from '../lib/api';
import type { SessionResponse } from '../stores/auth';
import { useOnboarding } from '../stores/onboarding';
import { AuthLayout } from './AuthLayout';
import { AUTH_MODES, type AuthMode } from './authMode';
import { useCompleteSignIn } from './SignUp';

const RESEND_COOLDOWN_S = 30;

export function VerifyCode({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const completeSignIn = useCompleteSignIn(mode);
  const { base } = AUTH_MODES[mode];
  const { pendingEmail, setPendingEmail } = useOnboarding();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!pendingEmail) return <Navigate to={base} replace />;
  const email = pendingEmail;

  async function resend(reason: string) {
    try {
      await apiFetch('/auth/email/start', { method: 'POST', body: { email }, auth: false });
      setCooldown(RESEND_COOLDOWN_S);
      setError(null);
      setNotice(reason);
    } catch (err) {
      setNotice(null);
      setError(friendlyError(err));
    }
    setCode('');
    inputRef.current?.focus();
  }

  async function verify(value: string) {
    if (verifying) return;
    if (!/^\d{6}$/.test(value)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setVerifying(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<SessionResponse>('/auth/email/verify', {
        method: 'POST',
        body: { email, code: value },
        auth: false,
      });
      completeSignIn(res, 'email');
    } catch (err) {
      setVerifying(false);
      const code = err instanceof ApiError ? err.code : null;
      if (code === 'invalid_code') {
        setError("That code didn't match — try again.");
        setCode('');
        inputRef.current?.focus();
      } else if (code === 'code_expired') {
        await resend("That code expired — we've sent you a new one.");
      } else if (code === 'too_many_attempts') {
        await resend("Too many tries — we've sent you a new code.");
      } else {
        setError(friendlyError(err));
      }
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void verify(code);
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Check your email</h1>
      <p className="auth-sub">
        We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <TextField
          ref={inputRef}
          label="Sign-in code"
          className="code-input"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(digits);
            if (error) setError(null);
            // Auto-submit once all six digits are in (typed, pasted or autofilled).
            if (digits.length === 6) void verify(digits);
          }}
          error={error}
        />
        {notice ? (
          <p className="form-notice" role="status">
            {notice}
          </p>
        ) : null}
        <Button type="submit" loading={verifying}>
          Continue
        </Button>
      </form>

      <div className="auth-links">
        <button
          type="button"
          className="link-button"
          disabled={cooldown > 0}
          onClick={() => void resend('New code sent — check your inbox.')}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setPendingEmail(null);
            navigate(base, { replace: true });
          }}
        >
          Use a different email
        </button>
      </div>
    </AuthLayout>
  );
}
