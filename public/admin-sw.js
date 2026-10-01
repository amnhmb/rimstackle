const cacheName = 'rimstackle-admin-v1';

self.addEventListener('install', event => { event.waitUntil(caches.open(cacheName).then(cache => cache.add('/'))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(response => response || caches.match('/'))));
});
