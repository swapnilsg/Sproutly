import { vi } from 'vitest';

/**
 * Installs fake Web Push browser APIs (jsdom has none). `permission` is what the user picks in
 * the browser prompt; `subscribeFails` makes pushManager.subscribe throw.
 */
export function fakePush({
  permission = 'granted' as NotificationPermission,
  subscribeFails = false,
} = {}) {
  const subscription = {
    toJSON: () => ({
      endpoint: 'https://push.example.com/send/abc',
      keys: { p256dh: 'BOr1gK8x', auth: 'tBHItJI5' },
    }),
  };
  const subscribe = vi.fn(async (_options?: PushSubscriptionOptionsInit) => {
    if (subscribeFails) throw new Error('push service unavailable');
    return subscription;
  });
  const registration = { pushManager: { subscribe } };
  const serviceWorker = {
    register: vi.fn(async () => registration),
    ready: Promise.resolve(registration),
  };
  const requestPermission = vi.fn(async () => permission);
  vi.stubGlobal('Notification', { requestPermission });
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
  return { requestPermission, subscribe, serviceWorker };
}

/** Removes the fakes installed by fakePush (vi.unstubAllGlobals handles the rest). */
export function removeFakePush() {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
}
