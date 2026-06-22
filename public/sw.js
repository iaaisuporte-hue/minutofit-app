// CoreFit — Service Worker (push + PWA offline shell)
// Push: notificações de lembrete. PWA: shell offline mínimo para navegações.

const SHELL_CACHE = 'corefit-shell-v1';

// Pré-cacheia o shell (index) para fallback offline em navegações.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(['/', '/index.html']).catch(() => {}))
  );
  self.skipWaiting();
});

// Limpa caches antigos ao ativar.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: SÓ trata navegações (network-first → cache do shell se offline).
// Assets, API e demais requests passam direto pelo browser — não interferimos.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Atualiza o shell em cache de forma best-effort.
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match('/index.html').then((c) => c || caches.match('/')))
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'CoreFit', body: event.data.text() };
  }

  const { title = 'CoreFit', body = '', tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/corefit-icon.svg',
      badge: '/corefit-icon.svg',
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
