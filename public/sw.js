/* Maestra: online-first service worker.
 * Supabase, Spotify and other API requests are intentionally never cached here.
 */
const CACHE_NAME = 'maestra-shell-v2';
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './favicon.ico',
  './favicon16.png',
  './favicon32.png',
  './apple-touch-icon.png',
  './logo192.png',
  './logo512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('maestra-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  const cacheable = ['script', 'style', 'font', 'image'].includes(request.destination);
  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached || network.catch(() => Response.error());
    })
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Maestra', body: 'Você tem uma nova notificação.' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Maestra', {
      body: data.body || 'Você tem uma nova notificação.',
      icon: data.icon || '/logo192.png',
      badge: data.badge || '/favicon32.png',
      tag: data.tag || 'maestra-notification',
      data: data.data || { url: '/notifications' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
