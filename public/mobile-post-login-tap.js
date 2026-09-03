(() => {
  const FAST_TAP_SELECTOR = [
    ".nav-item",
    "[data-go-page]",
    "#labAuthLoginButton",
    "[data-close-auth]",
    "#bookingForm button[type='submit']",
    "#dutyForm button[type='submit']",
    ".welcome-action-button",
    ".summary-link-button"
  ].join(",");

  let pointerStart = null;
  let triggeringFastClick = false;
  let suppressedTarget = null;
  let suppressUntil = 0;

  function isMobileTouchViewport() {
    return (
      window.innerWidth <= 720 &&
      (window.matchMedia("(pointer: coarse)").matches ||
        navigator.maxTouchPoints > 0)
    );
  }

  function getFastTapTarget(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    const button = target.closest(FAST_TAP_SELECTOR);
    if (!(button instanceof HTMLElement) || button.matches(":disabled")) {
      return null;
    }

    return button;
  }

  function showPageImmediately(target) {
    const pageName = target.dataset.page || target.dataset.goPage;
    if (!pageName) {
      return false;
    }

    if (typeof window.showPage === "function") {
      window.showPage(pageName);
      return true;
    }

    document.querySelectorAll(".page").forEach((page) => {
      page.classList.toggle("active", page.id === pageName);
    });

    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.page === pageName);
    });

    const pageTitle = document.querySelector("#pageTitle");
    const titles = {
      dashboard: "工作台",
      booking: "超净台预约",
      duty: "值日管理",
      settings: "设置"
    };

    if (pageTitle && titles[pageName]) {
      pageTitle.textContent = titles[pageName];
    }

    return true;
  }

  function activateTarget(target) {
    if (showPageImmediately(target)) {
      return;
    }

    triggeringFastClick = true;
    try {
      target.click();
    } finally {
      triggeringFastClick = false;
    }
  }

  function releaseAuthInteractionLock() {
    const modal = document.querySelector("#labAuthModal");
    const activeElement = document.activeElement;

    if (
      modal &&
      activeElement instanceof HTMLElement &&
      modal.contains(activeElement)
    ) {
      activeElement.blur();
    }

    if (modal) {
      modal.hidden = true;
      modal.style.pointerEvents = "none";
    }

    document.body.classList.remove("auth-modal-open");
    document.documentElement.classList.remove("auth-modal-open");

    window.requestAnimationFrame(() => {
      if (modal) {
        modal.style.pointerEvents = "";
      }
    });
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (
        !isMobileTouchViewport() ||
        !event.isPrimary ||
        event.pointerType === "mouse"
      ) {
        pointerStart = null;
        return;
      }

      const target = getFastTapTarget(event.target);
      pointerStart = target
        ? {
            target,
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
        !isMobileTouchViewport()
      ) {
        return;
      }

      const target = getFastTapTarget(event.target);
      const moved = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y
      );
      const elapsed = performance.now() - start.time;

      if (target !== start.target || moved > 12 || elapsed > 900) {
        return;
      }

      event.preventDefault();
      activateTarget(target);
      suppressedTarget = target;
      suppressUntil = performance.now() + 700;
    },
    { capture: true, passive: false }
  );

  document.addEventListener(
    "pointercancel",
    () => {
      pointerStart = null;
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const target = getFastTapTarget(event.target);
      if (
        !triggeringFastClick &&
        target &&
        target === suppressedTarget &&
        performance.now() < suppressUntil &&
        event.detail > 0
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener("lab:auth-changed", (event) => {
    if (event.detail?.user) {
      releaseAuthInteractionLock();
    }
  });
})();
