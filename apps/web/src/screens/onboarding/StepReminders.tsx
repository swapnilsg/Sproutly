import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { BellIcon, ClockIcon, InfoIcon } from '../../components/icons';
import { SproutMark } from '../../components/Logo';
import { track } from '../../lib/analytics';
import { apiFetch, friendlyError } from '../../lib/api';
import {
  askForPush,
  browserInfo,
  notificationsBlocked,
  pushSupported,
  type PushOutcome,
} from '../../lib/push';
import { browserTimeZone } from '../../onboarding/answers';
import { useAuth } from '../../stores/auth';

const DEFAULT_TIME = '08:00';

/** Snap "HH:MM" to the nearest quarter hour (the server only accepts :00, :15, :30, :45). */
export function toQuarterHour(value: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return DEFAULT_TIME;
  const total = Math.round((Number(match[1]) * 60 + Number(match[2])) / 15) * 15;
  const minutes = total % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function displayTime(value: string): string {
  const [h, m] = value.split(':').map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, h, m),
  );
}

/** Onboarding step 7: pick a daily reminder time, then allow notifications (asked last, no penalty). */
export function StepReminders() {
  const navigate = useNavigate();
  const [time, setTime] = useState(DEFAULT_TIME);
  // undefined = still asking the server; null = push not configured there.
  const [vapidKey, setVapidKey] = useState<string | null | undefined>(undefined);
  const [plantName, setPlantName] = useState<string | null>(null);
  const [busy, setBusy] = useState<'push' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(Date.now());
  const timeId = useId();

  useEffect(() => {
    apiFetch<{ vapid_public_key: string | null }>('/notifications/config', { auth: false })
      .then((config) => setVapidKey(config.vapid_public_key))
      .catch(() => setVapidKey(null));
    apiFetch<{ first_plant_name: string | null }>('/users/me/onboarding-state')
      .then((state) => setPlantName(state.first_plant_name))
      .catch(() => {});
  }, []);

  // Already blocked for this site: no prompt would appear, so offer in-app reminders instead.
  const blocked = notificationsBlocked();
  const canPush = pushSupported() && Boolean(vapidKey) && !blocked;
  const loading = vapidKey === undefined;
  const reminderTime = toQuarterHour(time);

  async function save(outcome: PushOutcome, button: 'push' | 'skip') {
    setBusy(button);
    setError(null);
    try {
      const res = await apiFetch<{ onboarding_step: number }>('/onboarding/reminders', {
        method: 'POST',
        body: {
          reminder_time: reminderTime,
          timezone: browserTimeZone(),
          permission: outcome.permission,
          subscription: outcome.permission === 'granted' ? outcome.subscription : null,
        },
      });
      useAuth.getState().setProgress(res.onboarding_step);
      track('onboarding_step_completed', {
        step: 7,
        permission: outcome.permission,
        reminder_time: reminderTime,
        time_on_step: Date.now() - shownAt.current,
      });
      navigate('/onboarding/8', { replace: true });
    } catch (err) {
      setError(friendlyError(err));
      setBusy(null);
    }
  }

  async function turnOn() {
    setBusy('push');
    const outcome = await askForPush(vapidKey!);
    if (outcome.permission === 'granted' || outcome.permission === 'denied') {
      track(`notification_permission_${outcome.permission}`, {
        ...browserInfo(),
        reminder_time: reminderTime,
      });
    }
    await save(outcome, 'push');
  }

  const subject = plantName ? `your ${plantName.toLowerCase()}` : 'your plants';

  return (
    <main className="reminders">
      <div className="reminders-body">
        <span className="reminders-icon">
          <BellIcon />
        </span>
        <div className="reminders-copy">
          <h1 className="reminders-title">Never forget to water again</h1>
          <p className="reminders-sub">
            We’ll send one reminder a day, only when a plant needs you.
          </p>
        </div>

        <div className="reminders-time">
          <label htmlFor={timeId} className="reminders-time-label">
            <ClockIcon />
            Remind me every day at
          </label>
          <input
            id={timeId}
            type="time"
            step={900}
            value={time}
            // The field is briefly empty while a segment is being retyped: keep that as-is,
            // and only apply the default and quarter-hour rounding when leaving the field.
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => setTime(reminderTime)}
            className="reminders-time-input"
            aria-describedby={`${timeId}-hint`}
          />
          <p id={`${timeId}-hint`} className="reminders-time-hint">
            In your local time
          </p>
        </div>

        {loading || canPush ? (
          <div className="reminders-preview" aria-hidden="true">
            <SproutMark size={36} />
            <span className="reminders-preview-text">
              <span className="reminders-preview-meta">
                <span>Sproutly</span>
                <span>{displayTime(reminderTime)}</span>
              </span>
              <span className="reminders-preview-title">Time to water {subject}</span>
              <span className="reminders-preview-body">It’s thirsty — takes 30 seconds.</span>
            </span>
          </div>
        ) : (
          <p className="reminders-note">
            <InfoIcon />
            {blocked
              ? 'Notifications are turned off for Sproutly in this browser, so we’ll remind you in the app instead.'
              : 'Your browser can’t show notifications, so we’ll remind you in the app instead.'}
          </p>
        )}
      </div>

      <div className="reminders-actions">
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {loading || canPush ? (
          <>
            <Button
              className="reminders-cta"
              onClick={() => void turnOn()}
              loading={loading || busy === 'push'}
              disabled={busy !== null}
            >
              Turn on reminders
            </Button>
            <button
              type="button"
              className="reminders-later"
              onClick={() => void save({ permission: 'later' }, 'skip')}
              disabled={loading || busy !== null}
            >
              Maybe later
            </button>
          </>
        ) : (
          <Button
            className="reminders-cta"
            onClick={() => void save({ permission: blocked ? 'denied' : 'unsupported' }, 'skip')}
            loading={busy === 'skip'}
          >
            Sounds good
          </Button>
        )}
      </div>
    </main>
  );
}
