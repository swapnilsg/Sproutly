import { useEffect, useRef } from 'react';

export const GOOGLE_CLIENT_ID: string | undefined =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    use_fedcm_for_prompt?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  prompt(): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let scriptPromise: Promise<GoogleIdApi> | null = null;

function loadGoogleIdentity(): Promise<GoogleIdApi> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () =>
      window.google ? resolve(window.google.accounts.id) : reject(new Error('GIS missing'));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface Props {
  onCredential(credential: string): void;
  /** Also show the One Tap prompt. */
  oneTap?: boolean;
}

/** "Continue with Google" button (+ One Tap). Renders nothing unless VITE_GOOGLE_CLIENT_ID is set. */
export function GoogleButton({ onCredential, oneTap = true }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    let api: GoogleIdApi | undefined;

    loadGoogleIdentity()
      .then((id) => {
        if (cancelled || !container.current) return;
        api = id;
        id.initialize({
          client_id: GOOGLE_CLIENT_ID!,
          callback: (res) => callback.current(res.credential),
          use_fedcm_for_prompt: true,
          cancel_on_tap_outside: true,
          context: 'signup',
          itp_support: true,
        });
        id.renderButton(container.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          width: Math.min(container.current.offsetWidth || 320, 400),
        });
        if (oneTap) id.prompt();
      })
      .catch(() => {
        // Google unreachable (offline, blocked): email sign-in still works.
      });

    return () => {
      cancelled = true;
      api?.cancel();
    };
  }, [oneTap]);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={container} className="google-button" data-testid="google-button" />;
}
