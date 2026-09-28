import { useAuth } from '../stores/auth';

export type AnalyticsEvent =
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_skipped'
  | 'starter_pack_selected'
  | 'notification_permission_granted'
  | 'notification_permission_denied'
  | 'onboarding_completed'
  | 'first_task_completed';

const SESSION_KEY = 'sproutly_session_id';
let memorySessionId: string | null = null;

function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    memorySessionId ??= crypto.randomUUID();
    return memorySessionId;
  }
}

/** Fire-and-forget: never throws, never retries, never blocks the UI. */
export function track(event: AnalyticsEvent, properties: Record<string, unknown> = {}): void {
  const token = useAuth.getState().session?.token;
  fetch('/api/v1/analytics/events', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ event_name: event, session_id: sessionId(), properties }),
  }).catch(() => {});
}
