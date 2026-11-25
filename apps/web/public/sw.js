/* Sproutly service worker: shows daily care reminders. Registered only after the user
   taps "Turn on reminders" (onboarding step 7). Sending happens server-side. */

// Take control of open tabs straight away (including the one that just registered this
// worker), so clicking a reminder can move that tab to the dashboard.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Sproutly';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Your plants need you today.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'sproutly-daily',
      data: { url: data.url || '/dashboard' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c);
      if (!open) return self.clients.openWindow(url);
      // navigate() rejects for tabs this worker doesn't control yet: open a window instead.
      return open
        .focus()
        .then((client) => (client.navigate ? client.navigate(url) : null))
        .then((client) => client || self.clients.openWindow(url))
        .catch(() => self.clients.openWindow(url));
    }),
  );
});
