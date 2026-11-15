// sw.js — Ghostwriter service worker.
// Cache-first for the app shell so the app works fully offline after
// the first load. Version the cache name when the shell changes.

const CACHE = 'ghostwriter-v2';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/crypto.js',
  './js/store.js',
  './js/reveal.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
