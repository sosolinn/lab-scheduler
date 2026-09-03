if ("serviceWorker" in navigator) {
  const RELOAD_FLAG = "__camellab_sw_v5_reloaded__";

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
