if ("serviceWorker" in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch((error) => {
      console.error("PWA service worker registration failed:", error);
    });
  };

  const scheduleRegistration = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(registerServiceWorker, { timeout: 2000 });
      return;
    }

    window.setTimeout(registerServiceWorker, 1000);
  };

  if (document.readyState === "complete") {
    scheduleRegistration();
  } else {
    window.addEventListener("load", scheduleRegistration, { once: true });
  }
}
