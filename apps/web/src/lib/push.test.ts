import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakePush, removeFakePush } from '../test/push';
import { askForPush, browserInfo, pushSupported } from './push';

const KEY =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

describe('push', () => {
  afterEach(removeFakePush);

  it('is unsupported where the browser lacks the Push APIs', () => {
    expect(pushSupported()).toBe(false);
  });

  it('is supported once service workers, PushManager and Notification exist', () => {
    fakePush();
    expect(pushSupported()).toBe(true);
  });

  it('subscribes after "Allow" with the decoded VAPID key', async () => {
    const { subscribe, serviceWorker } = fakePush();
    const outcome = await askForPush(KEY);
    expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    const options = subscribe.mock.calls[0]![0] as { applicationServerKey: Uint8Array };
    expect(options).toMatchObject({ userVisibleOnly: true });
    expect(options.applicationServerKey).toHaveLength(65);
    expect(outcome).toEqual({
      permission: 'granted',
      subscription: {
        endpoint: 'https://push.example.com/send/abc',
        keys: { p256dh: 'BOr1gK8x', auth: 'tBHItJI5' },
      },
    });
  });

  it('reports "Block" as denied without subscribing', async () => {
    const { subscribe } = fakePush({ permission: 'denied' });
    expect(await askForPush(KEY)).toEqual({ permission: 'denied' });
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('reports a dismissed prompt as "later"', async () => {
    fakePush({ permission: 'default' });
    expect(await askForPush(KEY)).toEqual({ permission: 'later' });
  });

  it('reuses this browser’s subscription when it was made with the same key', async () => {
    const key = Uint8Array.from(atob(KEY.replace(/-/g, '+').replace(/_/g, '/') + '='), (c) =>
      c.charCodeAt(0),
    );
    const { subscribe, existing } = fakePush({ existingKey: key });
    const outcome = await askForPush(KEY);
    expect(subscribe).not.toHaveBeenCalled();
    expect(existing!.unsubscribe).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      permission: 'granted',
      subscription: { endpoint: 'https://push.example.com/send/old' },
    });
  });

  it('replaces a subscription made with an old key (keys rotated) instead of failing', async () => {
    const { subscribe, existing } = fakePush({ existingKey: new Uint8Array(65).fill(7) });
    const outcome = await askForPush(KEY);
    expect(existing!.unsubscribe).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalled();
    expect(outcome).toMatchObject({
      permission: 'granted',
      subscription: { endpoint: 'https://push.example.com/send/abc' },
    });
  });

  it('gives up on a service worker that never activates, instead of hanging', async () => {
    vi.useFakeTimers();
    fakePush({ neverReady: true });
    const pending = askForPush(KEY);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ permission: 'unsupported' });
  });

  it('treats a failed subscription as unsupported rather than throwing', async () => {
    fakePush({ subscribeFails: true });
    expect(await askForPush(KEY)).toEqual({ permission: 'unsupported' });
  });
});

describe('browserInfo', () => {
  it('reduces a user agent to a coarse browser and OS', () => {
    expect(
      browserInfo(
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
      ),
    ).toEqual({ browser: 'chrome', os: 'android' });
    expect(
      browserInfo(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ browser: 'safari', os: 'ios' });
    expect(
      browserInfo(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0',
      ),
    ).toEqual({ browser: 'edge', os: 'windows' });
  });

  it('recognises Chrome, Firefox and Edge on mobile by their own tokens', () => {
    const ios =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
    expect(browserInfo(`${ios} CriOS/130.0 Mobile/15E148 Safari/604.1`)).toEqual({
      browser: 'chrome',
      os: 'ios',
    });
    expect(browserInfo(`${ios} FxiOS/130.0 Mobile/15E148 Safari/605.1.15`)).toEqual({
      browser: 'firefox',
      os: 'ios',
    });
    expect(
      browserInfo(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 EdgA/130.0',
      ),
    ).toEqual({ browser: 'edge', os: 'android' });
  });
});
