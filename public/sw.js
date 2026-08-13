// S2Core — Service Worker (offline shell + push)
//
// O bloco abaixo é REESCRITO NO BUILD pelo plugin `pwaPrecache` (vite.config.ts):
// SW_VERSION recebe o hash do bundle e PRECACHE_URLS a lista real de assets
// emitidos. Os valores aqui são só o fallback de desenvolvimento — em dev o SW
// nem chega a ser registrado (main.tsx exige import.meta.env.PROD).
//
// Por que precisa da lista: os assets do Vite têm nome hasheado. Cachear só o
// index.html deixava o app offline com tela branca — o HTML abria e os
// <script src="/assets/index-<hash>.js"> falhavam.
// build:precache-start
const SW_VERSION = 'dev';
const PRECACHE_URLS = ['/', '/index.html'];
// build:precache-end

const CACHE = `s2core-${SW_VERSION}`;

self.addEventListener('install', (event) => {
  // Sem skipWaiting: o SW novo espera. Uma aba aberta continua servida pelo SW
  // e pelo cache antigos até o usuário aceitar atualizar (ver SKIP_WAITING) ou
  // fechar todas as abas. Sem isso, apagar o cache antigo no activate quebraria
  // o carregamento de chunks lazy da aba que já estava aberta.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// A página pede a troca imediata depois que o usuário aceita o aviso de nova versão.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Outra origem (API, R2, CDN de fontes) passa direto: nunca cacheamos resposta
  // de API — dado de saúde não pode ficar em cache do navegador.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navegação: rede primeiro (pega deploy novo), index.html do cache se offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((c) => c || caches.match('/')))
    );
    return;
  }

  // Assets versionados: cache primeiro (o nome tem hash, então é imutável).
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
    )
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'S2Core', body: event.data.text() };
  }

  const { title = 'S2Core', body = '', tag, url } = payload;

  event.waitUntil(
    // Ícone e badge precisam ser PNG: Android/Chrome não renderiza SVG aqui.
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      renotify: Boolean(tag),
      data: { url: url || '/app/user/today' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/app/user/today';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/app/') && 'focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
