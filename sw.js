// sw.js
const CACHE_NAME = 'jadwal-v1';
const ASSETS = [
  './',
  './index.html',
  './firebase-config.js',
  './auth.js',
  './admin.js',
  './user.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
