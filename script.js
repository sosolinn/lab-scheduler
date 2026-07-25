const BOOKING_STORAGE_KEY = "labSchedulerBookings";
const DUTY_STORAGE_KEY = "labSchedulerDuties";

const BENCH_ANIMAL = "超净台1（动物）";
const BENCH_CELL = "超净台2（细胞）";
const AVAILABLE_BENCHES = [BENCH_ANIMAL, BENCH_CELL];

const DUTY_CHECKLIST = [
  {
    title: "1. 环境卫生",
    items: [
      "地面、实验台面清洁，无垃圾和积水",
      "水池及周围无污物"
    ]
  },
  {
    title: "2. 超净台/生物安全柜",
    items: [
      "台面无遗留物",
      "废液、废枪头及废弃培养物已清理",
      "风机、照明和紫外灯状态正常"
    ]
  },
  {
    title: "3. CO₂培养箱",
    items: [
      "温度、CO₂浓度正常，无报警",
      "培养箱门关闭严密",
      "水盘水量正常，箱内无污染和液体洒漏",
      "培养物标签清楚，无过期或污染细胞"
    ]
  },
  {
    title: "4. 公共设备",
    items: [
      "显微镜、离心机、水浴锅等清洁并关闭",
      "水浴锅水位和水质正常",
      "设备无异常噪声、报错或损坏"
    ]
  },
  {
    title: "5. 液氮与移液器",
    items: [
      "移液器已归位",
      "液氮罐液氮充足"
    ]
  },
  {
    title: "6. 废弃物处理",
    items: ["废液桶和垃圾袋未过满、无泄漏"]
  }
];

const ALL_DUTY_ITEMS = DUTY_CHECKLIST.flatMap((group) => group.items);

let bookings = normalizeBookings(loadData(BOOKING_STORAGE_KEY));
let duties = normalizeDuties(loadData(DUTY_STORAGE_KEY));
let visibleWeekStart = getStartOfWeek(new Date());

saveData(BOOKING_STORAGE_KEY, bookings);
saveData(DUTY_STORAGE_KEY, duties);

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
const dutyCheckboxes = Array.from(
  document.querySelectorAll('input[name="dutyCheck"]')
);
const dutySelectionCount = document.querySelector("#dutySelectionCount");
const selectAllDutyButton = document.querySelector("#selectAllDutyButton");
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

function normalizeDuties(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((duty) => {
    const checkedItems = Array.isArray(duty.checkedItems)
      ? duty.checkedItems.filter((item) => ALL_DUTY_ITEMS.includes(item))
      : [];

    const isLegacyRecord = !Array.isArray(duty.checkedItems);

    return {
      id: duty.id || createId(),
      name: duty.name || "未填写",
      date: duty.date || getTodayString(),
      checkedItems,
      abnormal: duty.abnormal || "",
      legacyTask: duty.legacyTask || (isLegacyRecord ? duty.task || "" : ""),
      legacyNote: duty.legacyNote || (isLegacyRecord ? duty.note || "" : ""),
      createdAt: duty.createdAt || ""
    };
  });
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

function updateDutySelectionCount() {
  const checkedCount = dutyCheckboxes.filter((checkbox) => checkbox.checked).length;
  const allChecked = checkedCount === ALL_DUTY_ITEMS.length;

  dutySelectionCount.textContent = `已勾选 ${checkedCount}/${ALL_DUTY_ITEMS.length} 项`;
  selectAllDutyButton.textContent = allChecked ? "全部取消" : "全部勾选";
}

dutyCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", updateDutySelectionCount);
});

selectAllDutyButton.addEventListener("click", () => {
  const shouldCheck = !dutyCheckboxes.every((checkbox) => checkbox.checked);

  dutyCheckboxes.forEach((checkbox) => {
    checkbox.checked = shouldCheck;
  });

  updateDutySelectionCount();
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

  const checkedItems = dutyCheckboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
  const abnormal = document.querySelector("#dutyAbnormal").value.trim();

  if (checkedItems.length === 0 && !abnormal) {
    showFormMessage(
      dutyMessage,
      "请至少勾选一项值日内容，或填写异常记录。",
      "error"
    );
    return;
  }

  const duty = {
    id: createId(),
    name: document.querySelector("#dutyName").value.trim(),
    date: dutyDateInput.value,
    checkedItems,
    abnormal,
    legacyTask: "",
    legacyNote: "",
    createdAt: new Date().toISOString()
  };

  duties.push(duty);
  saveData(DUTY_STORAGE_KEY, duties);

  dutyForm.reset();
  dutyDateInput.value = getTodayString();
  updateDutySelectionCount();

  showFormMessage(
    dutyMessage,
    `值日记录保存成功，已勾选 ${checkedItems.length}/${ALL_DUTY_ITEMS.length} 项。`,
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
  return [...data].sort((a, b) => {
    const dateComparison = b.date.localeCompare(a.date);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
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

function renderDutyChecklist(duty) {
  const selectedItems = new Set(duty.checkedItems || []);

  return DUTY_CHECKLIST.map((group) => {
    const items = group.items
      .map((item) => {
        const isChecked = selectedItems.has(item);

        return `
          <li class="duty-record-check ${isChecked ? "checked" : "unchecked"}">
            <span class="duty-record-check-icon">${isChecked ? "✓" : "—"}</span>
            <span>${escapeHtml(item)}</span>
          </li>
        `;
      })
      .join("");

    return `
      <section class="duty-record-group">
        <h4>${escapeHtml(group.title)}</h4>
        <ul>${items}</ul>
      </section>
    `;
  }).join("");
}

function renderDuties() {
  const sortedDuties = sortDuties(duties);

  if (sortedDuties.length === 0) {
    dutyList.innerHTML = createEmptyState(
      "暂无值日记录",
      "完成左侧检查并保存后，记录会显示在这里。"
    );
    return;
  }

  dutyList.innerHTML = sortedDuties
    .map((duty) => {
      const checkedCount = (duty.checkedItems || []).length;
      const isComplete = checkedCount === ALL_DUTY_ITEMS.length;
      const hasAbnormal = Boolean(duty.abnormal);
      const hasLegacyContent = Boolean(duty.legacyTask || duty.legacyNote);
      const statusText = hasLegacyContent
        ? "旧版记录"
        : `${checkedCount}/${ALL_DUTY_ITEMS.length} 项`;
      const statusClass = hasLegacyContent
        ? "legacy"
        : isComplete
          ? "complete"
          : "partial";

      const legacyMarkup = hasLegacyContent
        ? `
          <div class="duty-legacy-note">
            <strong>旧版值日内容</strong>
            ${duty.legacyTask ? `<p>任务：${escapeHtml(duty.legacyTask)}</p>` : ""}
            ${duty.legacyNote ? `<p>备注：${escapeHtml(duty.legacyNote)}</p>` : ""}
          </div>
        `
        : `
          <details class="duty-record-details">
            <summary>查看完整检查清单</summary>
            <div class="duty-record-checklist">
              ${renderDutyChecklist(duty)}
            </div>
          </details>
        `;

      return `
        <article class="record-item duty-record-item">
          <div class="record-main duty-record-main">
            <div class="record-title duty-record-title">
              <strong>${escapeHtml(duty.name)}</strong>
              <span class="duty-status-badge ${statusClass}">
                ${statusText}
              </span>
              ${hasAbnormal ? '<span class="duty-status-badge abnormal">有异常</span>' : ""}
            </div>

            <div class="record-details duty-record-summary">
              <div>${formatDate(duty.date)}</div>
              <div class="duty-abnormal-record${hasAbnormal ? " has-abnormal" : ""}">
                <strong>异常记录：</strong>
                ${escapeHtml(duty.abnormal || "无")}
              </div>
            </div>

            ${legacyMarkup}
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
updateDutySelectionCount();

renderAll();
