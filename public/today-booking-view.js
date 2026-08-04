(() => {
  const INSTALL_FLAG = "__LAB_TODAY_BOOKING_VIEW_INSTALLED__";
  const PERSON_COLOR_STORAGE_KEY = "labSchedulerBookingPersonColorsV2";
  const GOLDEN_ANGLE = 137.508;
  let installTimer = 0;
  let personColorRegistry = loadPersonColorRegistry();

  function normalizePersonKey(name) {
    return String(name || "未命名")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("zh-CN");
  }

  function loadPersonColorRegistry() {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(PERSON_COLOR_STORAGE_KEY) || "{}"
      );

      if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
        return {};
      }

      return Object.fromEntries(
        Object.entries(stored).filter(
          ([key, slot]) =>
            Boolean(key) && Number.isInteger(slot) && slot >= 0
        )
      );
    } catch {
      return {};
    }
  }

  function savePersonColorRegistry() {
    try {
      window.localStorage.setItem(
        PERSON_COLOR_STORAGE_KEY,
        JSON.stringify(personColorRegistry)
      );
    } catch {
      // 浏览器禁用本地存储时，当前页面内仍保持稳定配色。
    }
  }

  function getNextAvailableColorSlot(usedSlots) {
    let slot = 0;
    while (usedSlots.has(slot)) {
      slot += 1;
    }
    return slot;
  }

  function syncPersonColorRegistry() {
    const cleanedRegistry = {};
    const usedSlots = new Set();

    Object.entries(personColorRegistry).forEach(([key, slot]) => {
      if (
        key &&
        Number.isInteger(slot) &&
        slot >= 0 &&
        !usedSlots.has(slot)
      ) {
        cleanedRegistry[key] = slot;
        usedSlots.add(slot);
      }
    });

    const currentPeople = Array.from(
      new Set(
        bookings
          .map((booking) => normalizePersonKey(booking.name))
          .filter(Boolean)
      )
    ).sort((first, second) =>
      first.localeCompare(second, "zh-CN", { numeric: true })
    );

    currentPeople.forEach((personKey) => {
      if (Number.isInteger(cleanedRegistry[personKey])) {
        return;
      }

      const slot = getNextAvailableColorSlot(usedSlots);
      cleanedRegistry[personKey] = slot;
      usedSlots.add(slot);
    });

    personColorRegistry = cleanedRegistry;
    savePersonColorRegistry();
  }

  function getPersonColorSlot(name) {
    const personKey = normalizePersonKey(name);

    if (!Number.isInteger(personColorRegistry[personKey])) {
      const usedSlots = new Set(Object.values(personColorRegistry));
      personColorRegistry[personKey] = getNextAvailableColorSlot(usedSlots);
      savePersonColorRegistry();
    }

    return personColorRegistry[personKey];
  }

  function getPersonColors(name) {
    const slot = getPersonColorSlot(name);
    const hue = (212 + slot * GOLDEN_ANGLE) % 360;
    const saturation = 68 + (slot % 3) * 4;
    const accentLightness = hue >= 45 && hue <= 80 ? 34 : 40;

    return {
      accent: `hsl(${hue.toFixed(1)} ${saturation}% ${accentLightness}%)`,
      border: `hsl(${hue.toFixed(1)} ${Math.min(88, saturation + 8)}% 74%)`,
      background: `hsl(${hue.toFixed(1)} ${Math.min(92, saturation + 12)}% 96%)`
    };
  }

  function applyPersonColor(element, name) {
    if (!element) {
      return;
    }

    const colors = getPersonColors(name);
    element.classList.add("booking-person-colored");
    element.style.setProperty("--booking-person-accent", colors.accent);
    element.style.setProperty("--booking-person-border", colors.border);
    element.style.setProperty("--booking-person-bg", colors.background);
  }

  function removeLegacyPersonColorClasses(element) {
    Array.from(element.classList).forEach((className) => {
      if (/^booking-person-color-\d+$/.test(className)) {
        element.classList.remove(className);
      }
    });
  }

  function updateDashboardBookingHeading(today) {
    const heading = dashboardBookingList
      ?.closest(".dashboard-summary-card")
      ?.querySelector(".dashboard-summary-heading h3");

    if (heading) {
      heading.textContent = "今日预约情况";
    }

    if (dashboardWeekRange) {
      dashboardWeekRange.textContent = formatShortDate(today);
    }
  }

  function renderTodayDashboardBookings() {
    const today = getTodayString();
    const todayBookings = sortBookings(bookings).filter(
      (booking) => booking.date === today
    );

    syncPersonColorRegistry();
    updateDashboardBookingHeading(today);

    if (todayBookings.length === 0) {
      dashboardBookingList.innerHTML = createDashboardEmptyState(
        "今日暂无预约",
        "点击右上方“超净台预约”添加今天的预约。"
      );
      return;
    }

    dashboardBookingList.innerHTML = todayBookings
      .map((booking) => {
        const benchClass = getBenchClass(booking.bench);
        const date = parseDateString(booking.date);

        return `
          <div class="dashboard-summary-item dashboard-today-booking booking-person-colored">
            <div class="summary-date-block booking-person-date-block">
              <strong>${date.getDate()}</strong>
              <span>${date.getMonth() + 1}月</span>
            </div>
            <div class="summary-item-main">
              <div class="summary-item-title">
                <strong>${escapeHtml(booking.name)}</strong>
                <span class="summary-bench-badge ${benchClass}">${escapeHtml(booking.bench)}</span>
              </div>
              <p>${escapeHtml(booking.startTime)}–${escapeHtml(booking.endTime)} · ${escapeHtml(booking.purpose || "未填写实验内容")}</p>
            </div>
          </div>
        `;
      })
      .join("");

    Array.from(
      dashboardBookingList.querySelectorAll(".dashboard-today-booking")
    ).forEach((item, index) => {
      applyPersonColor(item, todayBookings[index]?.name);
    });
  }

  function removeExistingCountBadge(dayElement) {
    dayElement.querySelector(".week-day-booking-count")?.remove();
  }

  function addCompactDayCount(dayElement, bookingCount) {
    removeExistingCountBadge(dayElement);

    if (bookingCount <= 0) {
      return;
    }

    const dateElement = dayElement.querySelector(".week-day-date");
    if (!dateElement) {
      return;
    }

    const countBadge = document.createElement("span");
    countBadge.className = "week-day-booking-count";
    countBadge.textContent = `${bookingCount} 条`;
    dateElement.insertAdjacentElement("beforebegin", countBadge);
  }

  function decorateWeeklyBookings() {
    const today = getTodayString();
    const sortedBookings = sortBookings(bookings);
    const dayElements = Array.from(bookingList.querySelectorAll(".week-day"));

    syncPersonColorRegistry();

    dayElements.forEach((dayElement, dayIndex) => {
      const date = addDays(visibleWeekStart, dayIndex);
      const dateString = dateToString(date);
      const isToday = dateString === today;
      const dayBookings = sortedBookings.filter(
        (booking) => booking.date === dateString
      );
      const bookingItems = Array.from(
        dayElement.querySelectorAll(".week-booking-item")
      );

      dayElement.classList.toggle("week-day-detailed", isToday);
      dayElement.classList.toggle("week-day-compact", !isToday);

      if (isToday) {
        removeExistingCountBadge(dayElement);
      } else {
        addCompactDayCount(dayElement, dayBookings.length);
      }

      bookingItems.forEach((item, itemIndex) => {
        const booking = dayBookings[itemIndex];
        if (!booking) {
          return;
        }

        removeLegacyPersonColorClasses(item);
        applyPersonColor(item, booking.name);
        item.classList.toggle("week-booking-detailed", isToday);
        item.classList.toggle("week-booking-compact", !isToday);
        item.classList.toggle(
          "has-booking-actions",
          Boolean(
            item.querySelector("[data-edit-booking]") ||
              item.querySelector("[data-delete-booking]")
          )
        );

        if (isToday) {
          item.removeAttribute("title");
        } else {
          item.title = [
            `${booking.startTime}–${booking.endTime}`,
            booking.name,
            booking.bench,
            booking.purpose || "未填写实验内容"
          ].join(" · ");
        }
      });
    });
  }

  function installFocusedBookingView() {
    if (window[INSTALL_FLAG]) {
      return true;
    }

    if (
      typeof renderBookings !== "function" ||
      typeof renderDashboardBookings !== "function" ||
      typeof sortBookings !== "function" ||
      typeof getTodayString !== "function" ||
      !bookingList ||
      !dashboardBookingList
    ) {
      return false;
    }

    window[INSTALL_FLAG] = true;
    syncPersonColorRegistry();

    const renderBookingsWithPermissions = renderBookings;
    renderBookings = function renderTodayFocusedBookings() {
      const result = renderBookingsWithPermissions();
      decorateWeeklyBookings();
      return result;
    };

    renderDashboardBookings = renderTodayDashboardBookings;

    renderDashboardBookings();
    renderBookings();

    window.addEventListener("lab:bookings-refreshed", () => {
      syncPersonColorRegistry();
      renderDashboardBookings();
      decorateWeeklyBookings();
    });

    return true;
  }

  function waitForLegacyRuntime() {
    if (installFocusedBookingView()) {
      window.clearInterval(installTimer);
      return;
    }

    if (!installTimer) {
      installTimer = window.setInterval(() => {
        if (installFocusedBookingView()) {
          window.clearInterval(installTimer);
          installTimer = 0;
        }
      }, 100);
    }
  }

  waitForLegacyRuntime();

  const observer = new MutationObserver(() => {
    waitForLegacyRuntime();
    if (window[INSTALL_FLAG]) {
      observer.disconnect();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
