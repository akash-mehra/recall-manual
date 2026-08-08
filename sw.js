/* sw.js — basic app-shell caching. IndexedDB data is untouched by this
   (service workers don't cache IDB), this only makes the static files
   available offline.
*/

const CACHE_NAME = 'recall-manual-v10';
const ASSETS = [
  'index.html',
  'study.html',
  'create.html',
  'settings.html',
  'library.html',
  'manifest.json',
  'css/theme.css',
  'js/db.js',
  'js/sakura.js',
  'js/study.js',
  'js/canvas-draw.js',
  'js/camera-capture.js',
  'js/backup.js',
  'js/auth.js',
  'js/drive-sync.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isOwnOrigin = url.origin === self.location.origin;
  const isAppFile = isOwnOrigin && /\.(js|html)$/.test(url.pathname);
  const isNavigation = event.request.mode === 'navigate';

  if (isAppFile || isNavigation) {
    // Network-first for our own JS/HTML (and any navigation request): during
    // active development, always try to get the latest code first, only
    // falling back to cache if offline. Cache-first here has repeatedly bit
    // us with stale pages/scripts surviving a deploy — freshness matters
    // more than offline availability while this app is still in flux.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
