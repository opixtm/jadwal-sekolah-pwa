// sw.js
const CACHE_NAME = 'jadwal-v1.0.3'; // Forced update to clear old problematic config
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
  self.skipWaiting(); // Make new SW active immediately
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all open pages immediately
});

// Use Network-First Strategy (so the user always gets the latest push if online)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
