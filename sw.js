/* sw.js — basic app-shell caching. IndexedDB data is untouched by this
   (service workers don't cache IDB), this only makes the static files
   available offline.
*/

const CACHE_NAME = 'recall-manual-v1';
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
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
