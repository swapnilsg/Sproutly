// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

/** Loads public/sw.js into a fake service-worker global and returns its event handlers. */
function loadWorker(clients: unknown[] = []) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => (handlers[type] = fn),
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(async () => {}),
      matchAll: vi.fn(async () => clients),
      openWindow: vi.fn(async () => null),
    },
    registration: { showNotification: vi.fn(async () => {}) },
  };
  runInNewContext(readFileSync(new URL('./sw.js', import.meta.url), 'utf8'), { self });
  return { handlers, self };
}

async function click(handlers: Record<string, (event: unknown) => void>, url = '/dashboard') {
  let done: Promise<unknown> = Promise.resolve();
  handlers.notificationclick!({
    notification: { close: vi.fn(), data: { url } },
    waitUntil: (p: Promise<unknown>) => (done = p),
  });
  await done;
}

describe('service worker', () => {
  it('takes control of open tabs as soon as it activates', async () => {
    const { handlers, self } = loadWorker();
    handlers.install!({});
    let activated: Promise<unknown> = Promise.resolve();
    handlers.activate!({ waitUntil: (p: Promise<unknown>) => (activated = p) });
    await activated;
    expect(self.skipWaiting).toHaveBeenCalled();
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it('shows a pushed reminder with its title and body', async () => {
    const { handlers, self } = loadWorker();
    let shown: Promise<unknown> = Promise.resolve();
    handlers.push!({
      data: { json: () => ({ title: 'Time to water your basil', body: 'It’s thirsty.' }) },
      waitUntil: (p: Promise<unknown>) => (shown = p),
    });
    await shown;
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Time to water your basil',
      expect.objectContaining({ body: 'It’s thirsty.', data: { url: '/dashboard' } }),
    );
  });

  it('moves an open tab to the reminder’s page when clicked', async () => {
    const tab = { focus: vi.fn(async () => tab), navigate: vi.fn(async () => tab) };
    const { handlers, self } = loadWorker([tab]);
    await click(handlers);
    expect(tab.navigate).toHaveBeenCalledWith('/dashboard');
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('opens a window when the open tab can’t be navigated (not yet controlled)', async () => {
    const tab = {
      focus: vi.fn(async () => tab),
      navigate: vi.fn(async () => {
        throw new TypeError('not controlled');
      }),
    };
    const { handlers, self } = loadWorker([tab]);
    await click(handlers);
    expect(self.clients.openWindow).toHaveBeenCalledWith('/dashboard');
  });

  it('opens a window when the app isn’t open', async () => {
    const { handlers, self } = loadWorker([]);
    await click(handlers);
    expect(self.clients.openWindow).toHaveBeenCalledWith('/dashboard');
  });
});
