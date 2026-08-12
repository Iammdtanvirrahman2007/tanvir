const CACHE_NAME = "modelforge-shell-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./device.css",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./icons/model-forge-192.png",
  "./icons/model-forge-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const threeCdn = url.hostname === "unpkg.com";

  if (!sameOrigin && !threeCdn) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (!response || (response.status !== 200 && response.type !== "opaque")) {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(request, copy))
          .catch(() => {});

        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
