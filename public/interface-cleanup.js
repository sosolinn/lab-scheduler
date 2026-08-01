(() => {
  const selectorsToRemove = [
    ".settings-security-note",
    "#dutyBeijingTimeStatus",
    ".duty-people-help"
  ];

  function cleanupInterface() {
    document
      .querySelectorAll(selectorsToRemove.join(","))
      .forEach((element) => element.remove());
  }

  function initialize() {
    cleanupInterface();

    const observer = new MutationObserver(cleanupInterface);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
