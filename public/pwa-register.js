if ("serviceWorker" in navigator) {
  const isLocalDevelopment =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const LOCAL_CLEANUP_FLAG = "__camellab_local_sw_cleanup_v1__";
  const RELOAD_FLAG = "__camellab_sw_v6_reloaded__";

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
    ])
      .then(() => {
        if (
          navigator.serviceWorker.controller &&
          window.sessionStorage.getItem(LOCAL_CLEANUP_FLAG) !== "1"
        ) {
          window.sessionStorage.setItem(LOCAL_CLEANUP_FLAG, "1");
          window.location.reload();
        }
      })
      .catch((error) => {
        console.warn("本地开发缓存清理失败：", error);
      });
  } else {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.error("PWA service worker registration failed:", error);
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (window.sessionStorage.getItem(RELOAD_FLAG) === "1") return;
      window.sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    });
  }
}
