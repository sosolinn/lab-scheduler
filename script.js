const BOOKING_STORAGE_KEY = "labSchedulerBookings";
const DUTY_STORAGE_KEY = "labSchedulerDuties";

let bookings = loadData(BOOKING_STORAGE_KEY);
let duties = loadData(DUTY_STORAGE_KEY);

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

function loadData(key) {
  try {
    const storedData = localStorage.getItem(key);
    return storedData ? JSON.parse(storedData) : [];
  } catch (error) {
    console.error("读取本地数据失败：", error);
    return [];
  }
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

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
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

  bookingForm.reset();
  bookingDateInput.value = getTodayString();

  showFormMessage(
    bookingMessage,
    "预约保存成功。",
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

function renderBookings() {
  const sortedBookings = sortBookings(bookings);

  if (sortedBookings.length === 0) {
    bookingList.innerHTML = createEmptyState(
      "暂无预约记录",
      "填写左侧表单后，预约会显示在这里。"
    );
    return;
  }

  bookingList.innerHTML = sortedBookings
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
              <div>
                ${formatDate(booking.date)}
                ${escapeHtml(booking.startTime)}
                –
                ${escapeHtml(booking.endTime)}
              </div>

              <div>
                实验内容：
                ${escapeHtml(booking.purpose || "未填写")}
              </div>
            </div>
          </div>

          <button
            class="delete-button"
            data-delete-booking="${booking.id}"
          >
            删除
          </button>
        </article>
      `;
    })
    .join("");
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