import { vi } from 'vitest';

/**
 * Installs fake Web Push browser APIs (jsdom has none).
 * - permission: what the user picks in the prompt; current: Notification.permission beforehand
 * - subscribeFails: pushManager.subscribe throws
 * - existingKey: this browser already has a subscription made with this key
 * - neverReady: the service worker never activates (navigator.serviceWorker.ready never settles)
 */
export function fakePush({
  permission = 'granted' as NotificationPermission,
  current = 'default' as NotificationPermission,
  subscribeFails = false,
  existingKey = null as Uint8Array | null,
  neverReady = false,
} = {}) {
  const makeSubscription = (endpoint: string, key: Uint8Array | null) => ({
    options: { applicationServerKey: key ? key.slice().buffer : null },
    unsubscribe: vi.fn(async () => true),
    toJSON: () => ({ endpoint, keys: { p256dh: 'BOr1gK8x', auth: 'tBHItJI5' } }),
  });
  const existing = existingKey
    ? makeSubscription('https://push.example.com/send/old', existingKey)
    : null;
  const subscribe = vi.fn(async (_options?: PushSubscriptionOptionsInit) => {
    if (subscribeFails) throw new Error('push service unavailable');
    return makeSubscription('https://push.example.com/send/abc', null);
  });
  const getSubscription = vi.fn(async () => existing);
  const registration = { pushManager: { subscribe, getSubscription } };
  const serviceWorker = {
    register: vi.fn(async () => registration),
    ready: neverReady ? new Promise(() => {}) : Promise.resolve(registration),
  };
  const requestPermission = vi.fn(async () => permission);
  vi.stubGlobal('Notification', { requestPermission, permission: current });
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
  return { requestPermission, subscribe, getSubscription, serviceWorker, existing };
}

/** Removes the fakes installed by fakePush (vi.unstubAllGlobals handles the rest). */
export function removeFakePush() {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
}
