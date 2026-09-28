import type { ReactNode } from 'react';
import { SproutMark } from '../components/Logo';

/** Deep-forest sign-up shell: logo, wordmark and tagline above a white card. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-screen">
      <div className="auth-hero">
        <SproutMark size={64} />
        <p className="auth-brand">Sproutly</p>
        <p className="auth-tagline">Grow with confidence, one plant at a time</p>
      </div>
      <section className="auth-card">{children}</section>
    </main>
  );
}
