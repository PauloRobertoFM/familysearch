const CACHE_NAME = "genealogia-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./db.js",
  "./gedcom.js",
  "./store.js",
  "./cards.js",
  "./tree-view.js",
  "./person-view.js",
  "./import-view.js",
  "./export-view.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./sample/familia_miglioli.ged",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first over the precached CORE_ASSETS only: every asset the app needs
// offline is already in CORE_ASSETS, so there is no dynamic write-back here
// (which would otherwise let the runtime cache grow without bound). A GET
// that isn't in the cache just falls through to the network as normal.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
