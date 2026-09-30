import { useEffect } from 'react';
import { Link } from 'react-router';
import { SproutMark } from '../components/Logo';
import { track } from '../lib/analytics';
import { useOnboarding } from '../stores/onboarding';

// Steps 2–5 aren't built yet, so "Start my garden" goes straight to "Save your garden".
// Switch to '/onboarding/2' when step 2 ships.
export const START_ROUTE = '/onboarding/6';

function DropIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5c3 3.6 5.5 6.6 5.5 9.9a5.5 5.5 0 0 1-11 0C6.5 10.1 9 7.1 12 3.5z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  );
}

/** Onboarding step 1: the promise, before we ask for anything. */
export function Welcome() {
  useEffect(() => {
    if (useOnboarding.getState().markStep1Started()) track('onboarding_started');
  }, []);

  return (
    <main className="welcome">
      <div className="welcome-brand">
        <SproutMark size={72} />
        <p className="welcome-wordmark">Sproutly</p>
      </div>

      <div className="welcome-body">
        <div className="welcome-copy">
          <h1 className="welcome-title">Keep your first plants alive</h1>
          <p className="welcome-sub">We'll tell you exactly what to do, every day.</p>
        </div>

        {/* A glimpse of the daily task list — decorative, so hidden from screen readers. */}
        <div className="welcome-preview" aria-hidden="true">
          <div className="welcome-task">
            <span className="welcome-task-icon">
              <DropIcon />
            </span>
            <span className="welcome-task-text">
              <span className="welcome-task-title">Water your basil</span>
              <span className="welcome-task-when">Today · morning</span>
            </span>
            <span className="welcome-check welcome-check-done">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          </div>
          <div className="welcome-task">
            <span className="welcome-task-icon">
              <SunIcon />
            </span>
            <span className="welcome-task-text">
              <span className="welcome-task-title">Move mint into the sun</span>
              <span className="welcome-task-when">Today · any time</span>
            </span>
            <span className="welcome-check" />
          </div>
        </div>
      </div>

      <div className="welcome-actions">
        <Link to={START_ROUTE} className="welcome-cta">
          Start my garden
        </Link>
        <Link to="/signin" className="welcome-signin">
          I already have an account
        </Link>
        <p className="welcome-fine">Free · takes about 2 minutes</p>
      </div>
    </main>
  );
}
