/* sw.js — basic app-shell caching. IndexedDB data is untouched by this
   (service workers don't cache IDB), this only makes the static files
   available offline.
*/

const CACHE_NAME = 'recall-manual-v2';
const ASSETS = [
  'index.html',
  'study.html',
  'create.html',
  'manifest.json',
  'css/theme.css',
  'js/db.js',
  'js/sakura.js',
  'js/study.js',
  'js/canvas-draw.js',
  'js/camera-capture.js',
  'js/backup.js',
  'js/firebase-init.js',
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
  const isAppScript = url.origin === self.location.origin && url.pathname.endsWith('.js');

  if (isAppScript) {
    // Network-first for our own JS: always try to get the latest code first,
    // only fall back to cache if offline. Avoids silently serving stale
    // config/logic after a deploy (bit us once already with firebase-init.js).
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
