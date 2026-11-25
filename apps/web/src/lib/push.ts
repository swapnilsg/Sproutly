/** Web Push for daily reminders (onboarding step 7). */

export type PushOutcome =
  | {
      permission: 'granted';
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    }
  | { permission: 'denied' | 'later' | 'unsupported' };

/** Can this browser do Web Push at all? (Safari < 16.4 and iOS outside an installed app can't.) */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/**
 * Asks for notification permission and, if granted, subscribes this browser.
 * Never throws: anything that goes wrong after "Allow" counts as unsupported, so the
 * user always gets through onboarding (with in-app reminders).
 */
export async function askForPush(vapidPublicKey: string): Promise<PushOutcome> {
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return { permission: 'unsupported' };
  }
  if (permission === 'denied') return { permission: 'denied' };
  if (permission !== 'granted') return { permission: 'later' }; // dismissed the prompt

  try {
    await navigator.serviceWorker.register('/sw.js');
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(vapidPublicKey) as BufferSource,
    });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth)
      return { permission: 'unsupported' };
    return {
      permission: 'granted',
      subscription: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      },
    };
  } catch {
    return { permission: 'unsupported' };
  }
}

/** Coarse browser/OS names for analytics (no version numbers or fingerprinting detail). */
export function browserInfo(userAgent = navigator.userAgent): { browser: string; os: string } {
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? 'edge'
    : /Firefox\//.test(ua)
      ? 'firefox'
      : /Chrome\//.test(ua)
        ? 'chrome'
        : /Safari\//.test(ua)
          ? 'safari'
          : 'other';
  const os = /Android/.test(ua)
    ? 'android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'ios'
      : /Windows/.test(ua)
        ? 'windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macos'
          : /Linux/.test(ua)
            ? 'linux'
            : 'other';
  return { browser, os };
}
