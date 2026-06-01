// MetaCore — Push Notification Service Worker
// Handles incoming push events and displays meal reminder notifications.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'MetaCore', body: event.data.text() };
  }

  const { title = 'MetaCore', body = '', tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/minutofit-icon.svg',
      badge: '/minutofit-icon.svg',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/app/') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/app/ficha-nutri');
    })
  );
});
