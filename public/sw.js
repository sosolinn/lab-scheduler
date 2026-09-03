const CACHE_NAME = "camellab-pwa-v4";
const APP_SHELL = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function canCache(response) {
  return response && response.ok && response.type !== "opaque";
}

async function fetchAndCache(request) {
  const response = await fetch(request);

  if (canCache(response)) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const isNavigation = request.mode === "navigate";
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    ["style", "script", "image", "font"].includes(request.destination);

  if (!isNavigation && !isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        event.waitUntil(fetchAndCache(request).catch(() => undefined));
        return cached;
      }

      return fetchAndCache(request).catch(() => {
        if (isNavigation) return caches.match("/");
        return Response.error();
      });
    })
  );
});
