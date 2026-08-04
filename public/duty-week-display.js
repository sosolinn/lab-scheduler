(() => {
  const INITIALIZED_FLAG = "__LAB_DUTY_WEEK_DISPLAY_INITIALIZED__";

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function getWeekStart(date) {
    const result = new Date(date);
    const daysSinceMonday = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - daysSinceMonday);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function formatWeekRange(date) {
    const start = getWeekStart(date);
    const end = addDays(start, 6);
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();

    if (sameMonth) {
      return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日—${end.getDate()}日`;
    }

    if (sameYear) {
      return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日—${end.getMonth() + 1}月${end.getDate()}日`;
    }

    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日—${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`;
  }

  function initialize() {
    if (window[INITIALIZED_FLAG]) return true;

    const sourceInput = document.querySelector("#dutyDate");
    const formGroup = sourceInput?.closest(".form-group");
    const label = formGroup?.querySelector('label[for="dutyDate"]');
    if (!sourceInput || !formGroup || !label) return false;

    window[INITIALIZED_FLAG] = true;
    sourceInput.classList.add("duty-date-source");
    sourceInput.setAttribute("aria-hidden", "true");
    sourceInput.tabIndex = -1;

    const wrapper = document.createElement("div");
    wrapper.className = "duty-week-display-wrap";

    const weekInput = document.createElement("input");
    weekInput.type = "text";
    weekInput.id = "dutyWeekDisplay";
    weekInput.className = "duty-week-display";
    weekInput.readOnly = true;
    weekInput.setAttribute("aria-readonly", "true");
    weekInput.setAttribute("inputmode", "none");
    weekInput.placeholder = "正在同步本周…";

    const badge = document.createElement("span");
    badge.className = "duty-week-display-icon";
    badge.textContent = "本周";
    badge.setAttribute("aria-hidden", "true");

    wrapper.append(weekInput, badge);
    sourceInput.insertAdjacentElement("beforebegin", wrapper);

    const help = document.createElement("p");
    help.id = "dutyWeekDisplayHelp";
    help.className = "duty-week-display-help";
    help.textContent = "值日记录按周展示，实际提交日期仍由服务端北京时间自动确定。";

    const status = document.querySelector("#dutyBeijingTimeStatus");
    if (status) {
      status.insertAdjacentElement("beforebegin", help);
    } else {
      sourceInput.insertAdjacentElement("afterend", help);
    }

    label.textContent = "值日周次";
    label.htmlFor = weekInput.id;

    let lastDisplayValue = "";

    function syncWeekDisplay() {
      const date = parseDate(sourceInput.value);
      const nextValue = date ? `${formatWeekRange(date)}（本周）` : "";
      if (nextValue !== lastDisplayValue) {
        weekInput.value = nextValue;
        lastDisplayValue = nextValue;
      }

      const latestStatus = document.querySelector("#dutyBeijingTimeStatus");
      if (
        latestStatus &&
        !latestStatus.previousElementSibling?.classList.contains("duty-week-display-help")
      ) {
        latestStatus.insertAdjacentElement("beforebegin", help);
      }

      weekInput.setAttribute(
        "aria-describedby",
        [help.id, latestStatus?.id].filter(Boolean).join(" ")
      );
    }

    sourceInput.addEventListener("input", syncWeekDisplay);
    sourceInput.addEventListener("change", syncWeekDisplay);
    document.querySelector("#dutyForm")?.addEventListener("reset", () => {
      window.setTimeout(syncWeekDisplay, 0);
    });
    window.addEventListener("focus", syncWeekDisplay);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") syncWeekDisplay();
    });

    syncWeekDisplay();
    window.setInterval(syncWeekDisplay, 1000);
    return true;
  }

  if (!initialize()) {
    const timer = window.setInterval(() => {
      if (initialize()) window.clearInterval(timer);
    }, 100);
    window.setTimeout(() => window.clearInterval(timer), 15000);
  }
})();
