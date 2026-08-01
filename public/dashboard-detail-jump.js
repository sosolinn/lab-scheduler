(() => {
  const MOBILE_QUERY = "(max-width: 720px)";
  const DETAIL_TARGETS = {
    booking: ".weekly-booking-card",
    duty: ".duty-records-card"
  };

  function scrollToDetail(pageName) {
    const selector = DETAIL_TARGETS[pageName];
    if (!selector) return;

    const target = document.querySelector(selector);
    if (!target) return;

    target.style.scrollMarginTop = "14px";
    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest"
    });
  }

  document.addEventListener(
    "click",
    (event) => {
      if (!window.matchMedia(MOBILE_QUERY).matches) return;

      const button = event.target.closest(
        ".dashboard-summary-card .summary-link-button[data-go-page]"
      );
      if (!button) return;

      const pageName = button.dataset.goPage;
      if (!DETAIL_TARGETS[pageName]) return;

      // 原有点击处理会先切换页面；等待页面完成显示后再定位到详情卡片。
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => scrollToDetail(pageName));
      });
    },
    true
  );
})();
