// Workout PWA service worker — network-first for HTML, cache-first for assets
const CACHE = 'workout-v7.1-kb-variety';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
      // Notify any open clients that a new version is active so they can self-reload.
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((c) => { try { c.postMessage({ type: 'SW_UPDATED' }); } catch(e){} });
      }),
    ])
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const req = e.request;
  const url = new URL(req.url);
  // Treat HTML navigations + the index file as network-first so updates land instantly.
  const isHtml = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isHtml) {
    e.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const respClone = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, respClone));
        }
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }
  // Static assets — cache-first with background revalidate.
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const respClone = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, respClone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
