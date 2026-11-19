
const CACHE_NAME = 'compagnia-easy-shell-v2';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  // HTML e JavaScript: preferisce sempre la versione aggiornata.
  if (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      fetch(event.request).then(response => {
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Altri file: utilizza la cache quando disponibile.
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
