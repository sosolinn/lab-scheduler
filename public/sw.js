const CACHE_NAME = "camellab-pwa-v3";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/splash-screen.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/pwa-register.js",
  "/pwa-install.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== CACHE_NAME)
              .map((key) => caches.delete(key))
          )
        ),
      self.clients.claim()
    ])
  );
});

function isCacheableResponse(response) {
  return response && response.ok && response.type !== "opaque";
}

async function fetchAndCache(request) {
  const response = await fetch(request);

  if (isCacheableResponse(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isNavigation = request.mode === "navigate";
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    ["style", "script", "image", "font"].includes(request.destination);

  if (!isNavigation && !isStaticAsset) return;

  const networkPromise = fetchAndCache(request);
  event.waitUntil(networkPromise.catch(() => undefined));

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return networkPromise.catch(async () => {
        if (isNavigation) {
          return (await caches.match("/")) || Response.error();
        }

        return Response.error();
      });
    })
  );
});
