/**
 * Tailor's Ledger — offline app-shell service worker.
 *
 * Expo does not generate a service worker (see the PWA guide), so this is hand-rolled.
 * The strategy is chosen to give a real offline experience WITHOUT the classic "stale
 * PWA" trap the Expo docs warn about:
 *
 *  - Navigations (the HTML document): network-first, falling back to the cached shell.
 *    So a new deploy is picked up whenever the tailor is online, but the app still opens
 *    with no connection.
 *  - Same-origin static assets (the content-hashed JS bundle, fonts, icons):
 *    stale-while-revalidate. Hashed filenames can never go stale, so serving from cache
 *    is always safe and makes repeat loads instant + fully offline.
 *  - Cross-origin requests (Supabase / the sync backend): NOT intercepted. Sync owns its
 *    own ret/queue logic; the SW must never sit between a measurement session and the
 *    network (product spec §9 — never block on connectivity).
 *
 * Bump CACHE to force old caches out on the next activate.
 */
const CACHE = 'tailors-ledger-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle our own origin. Let API/storage traffic pass straight through.
  if (url.origin !== self.location.origin) return;

  // App navigations → network-first, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Static assets → stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
