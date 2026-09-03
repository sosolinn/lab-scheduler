if ("serviceWorker" in navigator) {
  const isLocalDevelopment =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

  if (isLocalDevelopment) {
    Promise.all([
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        ),
      "caches" in window
        ? caches
            .keys()
            .then((keys) =>
              Promise.all(
                keys
                  .filter((key) => key.startsWith("camellab-pwa-"))
                  .map((key) => caches.delete(key))
              )
            )
        : Promise.resolve()
    ]).catch((error) => {
      console.warn("本地开发缓存清理失败：", error);
    });
  } else {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.error("PWA service worker registration failed:", error);
      });
  }
}
