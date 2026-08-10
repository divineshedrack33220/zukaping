/* ZukaPing Admin — Service Worker (app shell, network-first with offline fallback) */
const CACHE_NAME = "zukaping-admin-v1";
const APP_SHELL = [
  "/admin/",
  "/admin/admin.css",
  "/admin/admin.js",
  "/admin/logo.png",
  "/admin/manifest.webmanifest",
  "/admin/icons/icon-192.png",
  "/admin/icons/icon-192-maskable.png",
  "/admin/icons/icon-180.png",
  "/admin/icons/icon-512.png",
  "/admin/icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
        )
      ),
      self.clients.claim(),
    ])
  );
});

function isAPI(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith("/api/");
}

function isNavigationRequest(request) {
  return request.mode === "navigate" && request.destination === "document";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // API traffic is always network-only (auth tokens must not be cached).
  if (isAPI(req)) {
    event.respondWith(fetch(req));
    return;
  }

  // Navigation requests: network-first, fall back to cached shell offline.
  if (isNavigationRequest(req)) {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/admin/", { ignoreSearch: true })
      )
    );
    return;
  }

  // Same-origin static assets (css/js/images/manifest): network-first so the
  // admin panel always runs the latest deployed logic; fall back to cache only
  // when the network is unavailable, and keep the cache fresh for offline use.
  if (req.method === "GET" && new URL(req.url).origin === self.location.origin) {
    const url = new URL(req.url);
    // skip the service-worker script itself to avoid a loop
    if (url.pathname === "/admin/sw.js") {
      event.respondWith(fetch(req));
      return;
    }
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && res.type !== "opaque") {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Everything else (cross-origin) hits the network.
  event.respondWith(fetch(req));
});
