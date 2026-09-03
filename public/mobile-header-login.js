(() => {
  const ACCOUNT_BUTTON_SELECTOR = "#labAuthAccountButton";
  let pointerStart = null;
  let lastDirectActivation = Number.NEGATIVE_INFINITY;

  function isMobileTouchViewport() {
    return (
      window.innerWidth <= 720 &&
      (window.matchMedia("(pointer: coarse)").matches ||
        navigator.maxTouchPoints > 0)
    );
  }

  function getAccountButton(target) {
    if (!(target instanceof Element)) return null;
    return target.closest(ACCOUNT_BUTTON_SELECTOR);
  }

  function isLoggedIn() {
    return Boolean(window.__labGetAuthState?.().user);
  }

  function openLoginDialog() {
    if (isLoggedIn()) return false;

    const modal = document.querySelector("#labAuthModal");
    if (modal && !modal.hidden) return true;

    if (typeof window.__labOpenAuthDialog === "function") {
      window.__labOpenAuthDialog();
      return true;
    }

    return false;
  }

  function prepareAccountButton() {
    const button = document.querySelector(ACCOUNT_BUTTON_SELECTOR);
    if (!button) return false;

    button.setAttribute("aria-label", "打开登录窗口");
    button.setAttribute("title", "登录楷模实验室");
    button.style.touchAction = "manipulation";
    return true;
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (
        !isMobileTouchViewport() ||
        !event.isPrimary ||
        event.pointerType === "mouse" ||
        isLoggedIn()
      ) {
        pointerStart = null;
        return;
      }

      const button = getAccountButton(event.target);
      pointerStart = button
        ? {
            button,
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            time: performance.now()
          }
        : null;
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "pointerup",
    (event) => {
      const start = pointerStart;
      pointerStart = null;

      if (
        !start ||
        start.pointerId !== event.pointerId ||
        !isMobileTouchViewport() ||
        isLoggedIn()
      ) {
        return;
      }

      const button = getAccountButton(event.target);
      const moved = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y
      );
      const elapsed = performance.now() - start.time;

      if (button !== start.button || moved > 12 || elapsed > 900) {
        return;
      }

      if (openLoginDialog()) {
        lastDirectActivation = performance.now();
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true, passive: false }
  );

  document.addEventListener(
    "click",
    (event) => {
      const button = getAccountButton(event.target);
      if (!button || !isMobileTouchViewport() || isLoggedIn()) return;

      if (performance.now() - lastDirectActivation < 700) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (openLoginDialog()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  if (!prepareAccountButton()) {
    const observer = new MutationObserver(() => {
      if (prepareAccountButton()) observer.disconnect();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    window.setTimeout(() => observer.disconnect(), 15000);
  }
})();
