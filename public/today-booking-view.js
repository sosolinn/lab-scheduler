(() => {
  const INSTALL_FLAG = "__LAB_TODAY_BOOKING_VIEW_INSTALLED__";
  const PERSON_COLOR_COUNT = 8;
  let installTimer = 0;

  function getPersonColorClass(name) {
    const text = String(name || "未命名").trim();
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }

    return `booking-person-color-${hash % PERSON_COLOR_COUNT}`;
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
        const personColorClass = getPersonColorClass(booking.name);
        const date = parseDateString(booking.date);

        return `
          <div class="dashboard-summary-item dashboard-today-booking ${personColorClass}">
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

        for (let colorIndex = 0; colorIndex < PERSON_COLOR_COUNT; colorIndex += 1) {
          item.classList.remove(`booking-person-color-${colorIndex}`);
        }

        item.classList.add(getPersonColorClass(booking.name));
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
