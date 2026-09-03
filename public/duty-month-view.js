(() => {
  const INITIALIZED_FLAG = "__LAB_DUTY_MONTH_VIEW_INITIALIZED__";
  const RUNTIME_KEY = "__LAB_SCHEDULER_RUNTIME__";

  function initializeDutyMonthView() {
    if (window[INITIALIZED_FLAG]) return true;
    const runtime = window[RUNTIME_KEY];
    if (
      !runtime ||
      typeof runtime.renderDuties !== "function" ||
      !runtime.dutyList
    ) {
      return false;
    }

    window[INITIALIZED_FLAG] = true;

    let visibleDutyMonth = new Date();
    visibleDutyMonth = new Date(
      visibleDutyMonth.getFullYear(),
      visibleDutyMonth.getMonth(),
      1
    );

    function dutyMonthStart(date) {
      return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function addDutyMonths(date, amount) {
      return new Date(date.getFullYear(), date.getMonth() + amount, 1);
    }

    function dutyMonthKey(date) {
      return `${date.getFullYear()}-${runtime.padNumber(date.getMonth() + 1)}`;
    }

    function formatDutyMonth(date) {
      return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    }

    function ensureDutyMonthNavigation() {
      const heading = document.querySelector(
        ".duty-records-card > .card-heading"
      );
      if (!heading) return null;

      heading.classList.add("duty-records-heading");

      const copy = heading.querySelector(":scope > div:first-child");
      const summary = copy?.querySelector("p");
      if (summary) {
        summary.id = "dutyMonthSummary";
      }

      let navigation = heading.querySelector("#dutyMonthNavigation");
      if (!navigation) {
        navigation = document.createElement("div");
        navigation.id = "dutyMonthNavigation";
        navigation.className = "duty-month-navigation";
        navigation.setAttribute("aria-label", "切换值日记录月份");
        navigation.innerHTML = `
          <button
            type="button"
            class="duty-month-nav-button"
            id="prevDutyMonthButton"
            aria-label="上一个月"
          >‹</button>
          <button
            type="button"
            class="duty-month-current-button"
            id="currentDutyMonthButton"
          >本月</button>
          <button
            type="button"
            class="duty-month-nav-button"
            id="nextDutyMonthButton"
            aria-label="下一个月"
          >›</button>
        `;
        heading.appendChild(navigation);

        navigation
          .querySelector("#prevDutyMonthButton")
          ?.addEventListener("click", () => {
            visibleDutyMonth = addDutyMonths(visibleDutyMonth, -1);
            runtime.renderDuties();
          });

        navigation
          .querySelector("#currentDutyMonthButton")
          ?.addEventListener("click", () => {
            visibleDutyMonth = dutyMonthStart(new Date());
            runtime.renderDuties();
          });

        navigation
          .querySelector("#nextDutyMonthButton")
          ?.addEventListener("click", () => {
            visibleDutyMonth = addDutyMonths(visibleDutyMonth, 1);
            runtime.renderDuties();
          });
      }

      return summary || null;
    }

    function renderMonthlyDutyRecord(duty) {
      const checkedCount = (duty.checkedItems || []).length;
      const isComplete = checkedCount === runtime.ALL_DUTY_ITEMS.length;
      const hasAbnormal = Boolean(duty.abnormal);
      const hasLegacyContent = Boolean(duty.legacyTask || duty.legacyNote);
      const statusText = hasLegacyContent
        ? "旧版记录"
        : `${checkedCount}/${runtime.ALL_DUTY_ITEMS.length} 项`;
      const statusClass = hasLegacyContent
        ? "legacy"
        : isComplete
          ? "complete"
          : "partial";

      const detailsMarkup = hasLegacyContent
        ? `
          <div class="duty-legacy-note">
            <strong>旧版值日内容</strong>
            ${duty.legacyTask ? `<p>任务：${runtime.escapeHtml(duty.legacyTask)}</p>` : ""}
            ${duty.legacyNote ? `<p>备注：${runtime.escapeHtml(duty.legacyNote)}</p>` : ""}
          </div>
        `
        : `
          <details class="duty-record-details">
            <summary>查看完整检查清单</summary>
            <div class="duty-record-checklist">${runtime.renderDutyChecklist(duty)}</div>
          </details>
        `;

      return `
        <article class="record-item duty-record-item">
          <div class="record-main duty-record-main">
            <div class="record-title duty-record-title">
              <strong>${runtime.escapeHtml(duty.name)}</strong>
              <span class="duty-status-badge ${statusClass}">${statusText}</span>
              ${hasAbnormal ? '<span class="duty-status-badge abnormal">有异常</span>' : ""}
            </div>
            <div class="record-details duty-record-summary">
              <div>${runtime.formatDate(duty.date)}</div>
              <div class="duty-abnormal-record${hasAbnormal ? " has-abnormal" : ""}">
                <strong>异常记录：</strong>${runtime.escapeHtml(duty.abnormal || "无")}
              </div>
            </div>
            ${detailsMarkup}
          </div>
          <button class="delete-button" data-delete-duty="${runtime.escapeHtml(duty.id)}">删除</button>
        </article>
      `;
    }

    runtime.renderDuties = function renderDutiesByMonth() {
      const summary = ensureDutyMonthNavigation();
      const monthKey = dutyMonthKey(visibleDutyMonth);
      const monthDuties = runtime.sortDuties(runtime.duties).filter((duty) =>
        String(duty.date || "").startsWith(monthKey)
      );

      if (summary) {
        summary.textContent = `${formatDutyMonth(visibleDutyMonth)} · ${monthDuties.length} 条记录`;
      }

      if (monthDuties.length === 0) {
        runtime.dutyList.innerHTML = runtime.createEmptyState(
          "本月暂无值日记录",
          "可切换月份查看历史记录，或填写本月值日检查。"
        );
        return;
      }

      const dutiesByDate = new Map();
      monthDuties.forEach((duty) => {
        const records = dutiesByDate.get(duty.date) || [];
        records.push(duty);
        dutiesByDate.set(duty.date, records);
      });

      const today = runtime.getTodayString();
      runtime.dutyList.innerHTML = Array.from(dutiesByDate.entries())
        .map(([date, records]) => {
          const isToday = date === today;
          return `
            <section class="duty-month-day-group${isToday ? " today" : ""}">
              <header class="duty-month-day-heading">
                <div>
                  <strong>${runtime.formatShortDate(date)}</strong>
                  ${isToday ? '<span class="duty-month-today-label">今天</span>' : ""}
                </div>
                <span>${records.length} 条</span>
              </header>
              <div class="duty-month-day-records">
                ${records.map(renderMonthlyDutyRecord).join("")}
              </div>
            </section>
          `;
        })
        .join("");
    };

    runtime.dutyDateInput?.addEventListener("change", () => {
      if (!runtime.dutyDateInput.value) return;
      visibleDutyMonth = dutyMonthStart(
        runtime.parseDateString(runtime.dutyDateInput.value)
      );
      runtime.renderDuties();
    });

    runtime.dutyForm?.addEventListener(
      "submit",
      () => {
        if (!runtime.dutyDateInput.value) return;
        visibleDutyMonth = dutyMonthStart(
          runtime.parseDateString(runtime.dutyDateInput.value)
        );
      },
      true
    );

    ensureDutyMonthNavigation();
    runtime.renderDuties();
    return true;
  }

  if (!initializeDutyMonthView()) {
    const timer = window.setInterval(() => {
      if (initializeDutyMonthView()) {
        window.clearInterval(timer);
      }
    }, 100);

    window.setTimeout(() => window.clearInterval(timer), 10000);
  }
})();
