(() => {
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

  window.addEventListener("lab:auth-changed", (event) => {
    if (event.detail?.user) {
      releaseAuthInteractionLock();
    }
  });
})();
