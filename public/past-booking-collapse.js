(() => {
  const INSTALL_FLAG = "__LAB_PAST_BOOKING_COLLAPSE_INSTALLED__";
  const RUNTIME_KEY = "__LAB_SCHEDULER_RUNTIME__";
  const BEIJING_TIME_ZONE = "Asia/Shanghai";
  const expandedDates = new Set();
  let installTimer = 0;
  let refreshTimer = 0;

  function getBeijingNow() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BEIJING_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );

    return {
      date: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}`
    };
  }

  function isBookingFinished(booking, now) {
    if (!booking?.date || !booking?.endTime) {
      return false;
    }

    if (booking.date < now.date) {
      return true;
    }

    return booking.date === now.date && booking.endTime <= now.time;
  }

  function removeToggle(dayBookingsElement) {
    dayBookingsElement
      ?.querySelector(".past-booking-toggle")
      ?.remove();
  }

  function createOrUpdateToggle(dayBookingsElement, dateString, count) {
    let toggle = dayBookingsElement.querySelector(".past-booking-toggle");
    const isExpanded = expandedDates.has(dateString);

    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "past-booking-toggle";
      dayBookingsElement.prepend(toggle);
    }

    const actionText = isExpanded ? "收起" : "展开";
    toggle.dataset.pastBookingDate = dateString;
    toggle.classList.toggle("is-expanded", isExpanded);
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.setAttribute("aria-label", `${actionText}${count}条已结束预约`);
    toggle.title = `${actionText}${count}条已结束预约`;
    toggle.innerHTML = `
      <span class="past-booking-toggle-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="m9 6 6 6-6 6"></path>
        </svg>
      </span>
      <span class="past-booking-toggle-count">${count} 条</span>
    `;
  }

  function decoratePastBookings() {
    const runtime = window[RUNTIME_KEY];
    const runtimeAvailable = Boolean(
      runtime?.bookingList &&
        typeof runtime.sortBookings === "function" &&
        typeof runtime.addDays === "function" &&
        typeof runtime.dateToString === "function" &&
        runtime.visibleWeekStart
    );

    if (!runtimeAvailable) {
      return false;
    }

    const now = getBeijingNow();
    const sortedBookings = runtime.sortBookings(runtime.bookings);
    const dayElements = Array.from(
      runtime.bookingList.querySelectorAll(".week-day")
    );

    dayElements.forEach((dayElement, dayIndex) => {
      const dateString = runtime.dateToString(
        runtime.addDays(runtime.visibleWeekStart, dayIndex)
      );
      const dayBookings = sortedBookings.filter(
        (booking) => booking.date === dateString
      );
      const bookingItems = Array.from(
        dayElement.querySelectorAll(".week-booking-item")
      );
      const dayBookingsElement = dayElement.querySelector(".week-day-bookings");

      if (!dayBookingsElement) {
        return;
      }

      const finishedEntries = [];

      bookingItems.forEach((item, itemIndex) => {
        const booking = dayBookings[itemIndex];
        const isFinished = isBookingFinished(booking, now);

        item.classList.toggle("past-booking-finished", isFinished);
        item.hidden = false;

        if (isFinished) {
          finishedEntries.push({ item, booking });
        }
      });

      if (finishedEntries.length === 0) {
        removeToggle(dayBookingsElement);
        expandedDates.delete(dateString);
        return;
      }

      createOrUpdateToggle(
        dayBookingsElement,
        dateString,
        finishedEntries.length
      );

      const isExpanded = expandedDates.has(dateString);
      finishedEntries.forEach(({ item }) => {
        item.hidden = !isExpanded;
      });
    });

    return true;
  }

  function installPastBookingCollapse() {
    if (window[INSTALL_FLAG]) {
      return true;
    }

    const runtime = window[RUNTIME_KEY];
    const runtimeAvailable = Boolean(
      runtime?.bookingList && typeof runtime.renderBookings === "function"
    );

    if (!runtimeAvailable) {
      return false;
    }

    window[INSTALL_FLAG] = true;

    const previousRenderBookings = runtime.renderBookings;
    runtime.renderBookings = function renderBookingsWithPastCollapse() {
      const result = previousRenderBookings();
      window.requestAnimationFrame(decoratePastBookings);
      return result;
    };

    runtime.bookingList.addEventListener("click", (event) => {
      const toggle = event.target.closest(".past-booking-toggle");
      if (!toggle) {
        return;
      }

      const dateString = toggle.dataset.pastBookingDate;
      if (!dateString) {
        return;
      }

      if (expandedDates.has(dateString)) {
        expandedDates.delete(dateString);
      } else {
        expandedDates.add(dateString);
      }

      decoratePastBookings();
    });

    window.addEventListener("lab:bookings-refreshed", () => {
      window.requestAnimationFrame(decoratePastBookings);
    });

    decoratePastBookings();
    refreshTimer = window.setInterval(decoratePastBookings, 30000);

    window.addEventListener(
      "pagehide",
      () => {
        window.clearInterval(refreshTimer);
      },
      { once: true }
    );

    return true;
  }

  function waitForRuntime() {
    if (installPastBookingCollapse()) {
      window.clearInterval(installTimer);
      installTimer = 0;
      return;
    }

    if (!installTimer) {
      installTimer = window.setInterval(() => {
        if (installPastBookingCollapse()) {
          window.clearInterval(installTimer);
          installTimer = 0;
        }
      }, 100);
    }
  }

  waitForRuntime();
})();
