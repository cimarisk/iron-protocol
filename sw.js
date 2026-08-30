// Workout PWA service worker — network-first for HTML, cache-first for assets
const CACHE = 'workout-v8.7-gymfloor';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  // Per-file and tolerant. addAll() is atomic — one 404 on any entry and NOTHING
  // gets cached, silently leaving the app with no offline capability at all.
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {}))))
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
  const isHtml = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');

  if (isHtml) {
    // Network-first so updates land instantly — but a 404 or 500 is a FAILURE,
    // not a page. Serving an error page over a perfectly good cached app is how
    // a user concludes the app is broken and clears their data.
    e.respondWith(
      fetch(req).then((resp) => {
        if (!resp || !resp.ok || resp.type !== 'basic') throw new Error('bad response');
        const respClone = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, respClone));
        return resp;
      }).catch(() =>
        caches.match(req).then((r) => r || caches.match('./index.html'))
      )
    );
    return;
  }

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
