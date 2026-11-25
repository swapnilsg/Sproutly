/* Sproutly service worker: shows daily care reminders. Registered only after the user
   taps "Turn on reminders" (onboarding step 7). Sending happens server-side. */

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
      if (open) {
        open.navigate(url);
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
