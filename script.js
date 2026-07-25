const BOOKING_STORAGE_KEY = "labSchedulerBookings";
const DUTY_STORAGE_KEY = "labSchedulerDuties";

const BENCH_ANIMAL = "超净台1（动物）";
const BENCH_CELL = "超净台2（细胞）";
const AVAILABLE_BENCHES = [BENCH_ANIMAL, BENCH_CELL];

let bookings = normalizeBookings(loadData(BOOKING_STORAGE_KEY));
let duties = loadData(DUTY_STORAGE_KEY);
let visibleWeekStart = getStartOfWeek(new Date());

saveData(BOOKING_STORAGE_KEY, bookings);

const pageTitles = {
  dashboard: "工作台",
  booking: "超净台预约",
  duty: "值日排班"
};

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");
const pageTitle = document.querySelector("#pageTitle");

const bookingForm = document.querySelector("#bookingForm");
const dutyForm = document.querySelector("#dutyForm");

const bookingList = document.querySelector("#bookingList");
const dutyList = document.querySelector("#dutyList");
const dashboardBookingList = document.querySelector(
  "#dashboardBookingList"
);

const bookingMessage = document.querySelector("#bookingMessage");
const dutyMessage = document.querySelector("#dutyMessage");

const bookingDateInput = document.querySelector("#bookingDate");
const dutyDateInput = document.querySelector("#dutyDate");
const weekRangeLabel = document.querySelector("#weekRangeLabel");
const prevWeekButton = document.querySelector("#prevWeekButton");
const currentWeekButton = document.querySelector("#currentWeekButton");
const nextWeekButton = document.querySelector("#nextWeekButton");

function loadData(key) {
  try {
    const storedData = localStorage.getItem(key);
    return storedData ? JSON.parse(storedData) : [];
  } catch (error) {
    console.error("读取本地数据失败：", error);
    return [];
  }
}

function normalizeBookings(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((booking) => {
      const benchNameMap = {
        "超净台 1": BENCH_ANIMAL,
        "超净台1": BENCH_ANIMAL,
        "超净台 2": BENCH_CELL,
        "超净台2": BENCH_CELL
      };

      return {
        ...booking,
        bench: benchNameMap[booking.bench] || booking.bench
      };
    })
    .filter((booking) => AVAILABLE_BENCHES.includes(booking.bench));
}

function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function dateToString(date) {
  return [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate())
  ].join("-");
}

function parseDateString(dateString) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function getStartOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);

  return result;
}

function getTodayString() {
  return dateToString(new Date());
}

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(parseDateString(dateString));
}

function formatWeekRange(startDate, endDate) {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  const startText = `${startDate.getMonth() + 1}月${startDate.getDate()}日`;
  const endText = `${endDate.getMonth() + 1}月${endDate.getDate()}日`;

  if (startYear === endYear) {
    return `${startYear}年 ${startText}—${endText}`;
  }

  return `${startYear}年${startText}—${endYear}年${endText}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

function showPage(pageName) {
  pages.forEach((page) => {
    page.classList.toggle("active", page.id === pageName);
  });

  navItems.forEach((item) => {
    item.classList.toggle(
      "active",
      item.dataset.page === pageName
    );
  });

  pageTitle.textContent = pageTitles[pageName];

  if (pageName === "booking") {
    renderBookings();
  }
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    showPage(item.dataset.page);
  });
});

document.querySelectorAll("[data-go-page]").forEach((button) => {
  button.addEventListener("click", () => {
    showPage(button.dataset.goPage);
  });
});

document
  .querySelector("#quickBookingButton")
  .addEventListener("click", () => {
    showPage("booking");
    document.querySelector("#bookingName").focus();
  });

prevWeekButton.addEventListener("click", () => {
  visibleWeekStart = addDays(visibleWeekStart, -7);
  renderBookings();
});

currentWeekButton.addEventListener("click", () => {
  visibleWeekStart = getStartOfWeek(new Date());
  renderBookings();
});

nextWeekButton.addEventListener("click", () => {
  visibleWeekStart = addDays(visibleWeekStart, 7);
  renderBookings();
});

bookingDateInput.addEventListener("change", () => {
  if (!bookingDateInput.value) {
    return;
  }

  visibleWeekStart = getStartOfWeek(
    parseDateString(bookingDateInput.value)
  );
  renderBookings();
});

function hasBookingConflict(newBooking) {
  return bookings.some((existingBooking) => {
    const sameDate =
      existingBooking.date === newBooking.date;

    const sameBench =
      existingBooking.bench === newBooking.bench;

    const timeOverlap =
      newBooking.startTime < existingBooking.endTime &&
      newBooking.endTime > existingBooking.startTime;

    return sameDate && sameBench && timeOverlap;
  });
}

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const booking = {
    id: createId(),
    name: document.querySelector("#bookingName").value.trim(),
    bench: document.querySelector("#benchNumber").value,
    date: bookingDateInput.value,
    startTime: document.querySelector("#startTime").value,
    endTime: document.querySelector("#endTime").value,
    purpose:
      document.querySelector("#bookingPurpose").value.trim()
  };

  if (!AVAILABLE_BENCHES.includes(booking.bench)) {
    showFormMessage(
      bookingMessage,
      "请选择可预约的超净台。",
      "error"
    );
    return;
  }

  if (booking.endTime <= booking.startTime) {
    showFormMessage(
      bookingMessage,
      "结束时间必须晚于开始时间。",
      "error"
    );
    return;
  }

  if (hasBookingConflict(booking)) {
    showFormMessage(
      bookingMessage,
      `${booking.bench} 在该时间段已经被预约，请更换时间或超净台。`,
      "error"
    );
    return;
  }

  bookings.push(booking);
  saveData(BOOKING_STORAGE_KEY, bookings);

  visibleWeekStart = getStartOfWeek(
    parseDateString(booking.date)
  );

  bookingForm.reset();
  bookingDateInput.value = getTodayString();

  showFormMessage(
    bookingMessage,
    "预约保存成功，已显示在右侧周预约表中。",
    "success"
  );

  renderAll();
});

dutyForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const duty = {
    id: createId(),
    name: document.querySelector("#dutyName").value.trim(),
    date: dutyDateInput.value,
    task: document.querySelector("#dutyTask").value,
    note: document.querySelector("#dutyNote").value.trim()
  };

  duties.push(duty);
  saveData(DUTY_STORAGE_KEY, duties);

  dutyForm.reset();
  dutyDateInput.value = getTodayString();

  showFormMessage(
    dutyMessage,
    "值日安排保存成功。",
    "success"
  );

  renderAll();
});

function showFormMessage(element, message, type) {
  element.textContent = message;
  element.className = `form-message ${type}`;

  window.setTimeout(() => {
    element.textContent = "";
    element.className = "form-message";
  }, 4000);
}

function sortBookings(data) {
  return [...data].sort((a, b) => {
    const firstDate = `${a.date}T${a.startTime}`;
    const secondDate = `${b.date}T${b.startTime}`;

    return firstDate.localeCompare(secondDate);
  });
}

function sortDuties(data) {
  return [...data].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

function getBenchClass(bench) {
  return bench === BENCH_ANIMAL ? "animal" : "cell";
}

function renderBookings() {
  const weekEnd = addDays(visibleWeekStart, 6);
  const today = getTodayString();
  const weekdayNames = [
    "周一",
    "周二",
    "周三",
    "周四",
    "周五",
    "周六",
    "周日"
  ];

  weekRangeLabel.textContent = formatWeekRange(
    visibleWeekStart,
    weekEnd
  );

  bookingList.innerHTML = Array.from(
    { length: 7 },
    (_, index) => {
      const date = addDays(visibleWeekStart, index);
      const dateString = dateToString(date);
      const dayBookings = sortBookings(bookings).filter(
        (booking) => booking.date === dateString
      );
      const isToday = dateString === today;

      const bookingItems = dayBookings.length
        ? dayBookings
            .map((booking) => {
              const benchClass = getBenchClass(booking.bench);

              return `
                <article class="week-booking-item ${benchClass}">
                  <button
                    type="button"
                    class="week-delete-button"
                    data-delete-booking="${booking.id}"
                    aria-label="删除${escapeHtml(booking.name)}的预约"
                    title="删除预约"
                  >
                    ×
                  </button>

                  <strong class="week-booking-time">
                    ${escapeHtml(booking.startTime)}
                    –
                    ${escapeHtml(booking.endTime)}
                  </strong>
                  <span class="week-booking-name">
                    ${escapeHtml(booking.name)}
                  </span>
                  <span class="week-booking-bench">
                    ${escapeHtml(booking.bench)}
                  </span>
                  <span class="week-booking-purpose">
                    ${escapeHtml(booking.purpose || "未填写实验内容")}
                  </span>
                </article>
              `;
            })
            .join("")
        : '<p class="week-empty">暂无预约</p>';

      return `
        <section class="week-day${isToday ? " today" : ""}">
          <header class="week-day-header">
            <div class="week-day-name">
              <span>${weekdayNames[index]}</span>
              ${isToday ? '<span class="today-label">今天</span>' : ""}
            </div>
            <div class="week-day-date">
              ${date.getMonth() + 1}月${date.getDate()}日
            </div>
          </header>

          <div class="week-day-bookings">
            ${bookingItems}
          </div>
        </section>
      `;
    }
  ).join("");
}

function renderDashboardBookings() {
  const today = getTodayString();

  const upcomingBookings = sortBookings(bookings)
    .filter((booking) => booking.date >= today)
    .slice(0, 5);

  if (upcomingBookings.length === 0) {
    dashboardBookingList.innerHTML = createEmptyState(
      "暂无近期预约",
      "点击“新建预约”添加第一条超净台预约。"
    );
    return;
  }

  dashboardBookingList.innerHTML = upcomingBookings
    .map((booking) => {
      return `
        <article class="record-item">
          <div class="record-main">
            <div class="record-title">
              <strong>${escapeHtml(booking.name)}</strong>
              <span class="badge">
                ${escapeHtml(booking.bench)}
              </span>
            </div>

            <div class="record-details">
              ${formatDate(booking.date)}
              ${escapeHtml(booking.startTime)}
              –
              ${escapeHtml(booking.endTime)}
              ·
              ${escapeHtml(booking.purpose || "未填写实验内容")}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderDuties() {
  const sortedDuties = sortDuties(duties);

  if (sortedDuties.length === 0) {
    dutyList.innerHTML = createEmptyState(
      "暂无值日安排",
      "填写左侧表单后，值日安排会显示在这里。"
    );
    return;
  }

  dutyList.innerHTML = sortedDuties
    .map((duty) => {
      return `
        <article class="record-item">
          <div class="record-main">
            <div class="record-title">
              <strong>${escapeHtml(duty.name)}</strong>
              <span class="badge">
                ${escapeHtml(duty.task)}
              </span>
            </div>

            <div class="record-details">
              <div>${formatDate(duty.date)}</div>
              <div>
                备注：
                ${escapeHtml(duty.note || "无")}
              </div>
            </div>
          </div>

          <button
            class="delete-button"
            data-delete-duty="${duty.id}"
          >
            删除
          </button>
        </article>
      `;
    })
    .join("");
}

function renderStatistics() {
  const today = getTodayString();

  const todayBookingCount = bookings.filter(
    (booking) => booking.date === today
  ).length;

  document.querySelector("#todayBookingCount").textContent =
    todayBookingCount;

  document.querySelector("#totalBookingCount").textContent =
    bookings.length;

  document.querySelector("#totalDutyCount").textContent =
    duties.length;
}

function createEmptyState(title, description) {
  return `
    <div class="empty-state">
      <strong>${title}</strong>
      <p>${description}</p>
    </div>
  `;
}

bookingList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-booking]");

  if (!button) {
    return;
  }

  const bookingId = button.dataset.deleteBooking;

  const shouldDelete = window.confirm(
    "确定删除这条预约记录吗？"
  );

  if (!shouldDelete) {
    return;
  }

  bookings = bookings.filter(
    (booking) => booking.id !== bookingId
  );

  saveData(BOOKING_STORAGE_KEY, bookings);
  renderAll();
});

dutyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-duty]");

  if (!button) {
    return;
  }

  const dutyId = button.dataset.deleteDuty;

  const shouldDelete = window.confirm(
    "确定删除这条值日安排吗？"
  );

  if (!shouldDelete) {
    return;
  }

  duties = duties.filter((duty) => duty.id !== dutyId);

  saveData(DUTY_STORAGE_KEY, duties);
  renderAll();
});

function renderAll() {
  renderBookings();
  renderDashboardBookings();
  renderDuties();
  renderStatistics();
}

bookingDateInput.value = getTodayString();
dutyDateInput.value = getTodayString();

renderAll();
