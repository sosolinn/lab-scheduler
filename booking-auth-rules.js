let __labEditingBookingId = null;
const __labBookingSubmitButton = bookingForm.querySelector('button[type="submit"]');
const __labBookingActionRow = document.createElement("div");
const __labBookingCancelEditButton = document.createElement("button");

__labBookingActionRow.className = "booking-edit-actions";
__labBookingCancelEditButton.type = "button";
__labBookingCancelEditButton.className = "booking-cancel-edit-button";
__labBookingCancelEditButton.textContent = "取消修改";
__labBookingCancelEditButton.hidden = true;

if (__labBookingSubmitButton) {
  __labBookingSubmitButton.insertAdjacentElement("beforebegin", __labBookingActionRow);
  __labBookingActionRow.append(
    __labBookingSubmitButton,
    __labBookingCancelEditButton
  );

  const note = document.createElement("p");
  note.className = "booking-auth-required-note";
  note.textContent = "只能修改和删除本人预约。";
  __labBookingActionRow.insertAdjacentElement("afterend", note);
}

function __labBookingNames(value) {
  return String(value || "")
    .split(/[、,，;；/]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function __labCurrentAuthUser() {
  return window.__labGetAuthState?.().user || null;
}

function __labUpdateBookingAccessUi() {
  const authState = window.__labGetAuthState?.() || {};
  if (!__labBookingSubmitButton) {
    return;
  }

  __labBookingSubmitButton.disabled = !authState.user;
  if (!authState.user) {
    __labBookingSubmitButton.textContent = "登录后保存预约";
  } else if (__labEditingBookingId) {
    __labBookingSubmitButton.textContent = "保存预约修改";
  } else {
    __labBookingSubmitButton.textContent = "保存预约";
  }
}

function __labCancelBookingEdit({ reset = true } = {}) {
  __labEditingBookingId = null;
  __labBookingCancelEditButton.hidden = true;
  if (reset) {
    bookingForm.reset();
    bookingDateInput.value = getTodayString();
  }
  __labUpdateBookingAccessUi();
}

function __labStartBookingEdit(booking) {
  if (!booking?.canManage) {
    showFormMessage(bookingMessage, "你无权修改这条预约。", "error");
    return;
  }

  __labEditingBookingId = booking.id;
  document.querySelector("#benchNumber").value = booking.bench;
  bookingDateInput.value = booking.date;
  document.querySelector("#startTime").value = booking.startTime;
  document.querySelector("#endTime").value = booking.endTime;
  document.querySelector("#bookingPurpose").value = booking.purpose || "";
  window.dispatchEvent(
    new CustomEvent("lab:people-picker-set", {
      detail: { type: "booking", names: __labBookingNames(booking.name) }
    })
  );
  __labBookingCancelEditButton.hidden = false;
  __labUpdateBookingAccessUi();
  showFormMessage(bookingMessage, "正在修改预约，保存后将覆盖原记录。", "success");
  bookingForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

const __labLegacyRenderBookingsForAuth = renderBookings;
renderBookings = function renderBookingsWithPermissions() {
  const result = __labLegacyRenderBookingsForAuth();
  const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));

  bookingList.querySelectorAll("[data-delete-booking]").forEach((deleteButton) => {
    const booking = bookingMap.get(deleteButton.dataset.deleteBooking);
    const item = deleteButton.closest(".week-booking-item");

    if (!booking?.canManage) {
      deleteButton.remove();
      return;
    }

    if (item && !item.querySelector("[data-edit-booking]")) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "booking-edit-button";
      editButton.dataset.editBooking = booking.id;
      editButton.textContent = "编辑";
      editButton.setAttribute("aria-label", `编辑${booking.name}的预约`);
      item.appendChild(editButton);
    }
  });

  if (
    __labEditingBookingId &&
    !bookings.some(
      (booking) => booking.id === __labEditingBookingId && booking.canManage
    )
  ) {
    __labCancelBookingEdit();
  }

  return result;
};

bookingList.addEventListener(
  "click",
  (event) => {
    const editButton = event.target.closest("[data-edit-booking]");
    if (editButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const booking = bookings.find(
        (item) => item.id === editButton.dataset.editBooking
      );
      __labStartBookingEdit(booking);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-booking]");
    if (deleteButton) {
      const booking = bookings.find(
        (item) => item.id === deleteButton.dataset.deleteBooking
      );
      if (!booking?.canManage) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showFormMessage(bookingMessage, "你无权删除这条预约。", "error");
        return;
      }
      if (__labEditingBookingId === booking.id) {
        window.setTimeout(() => __labCancelBookingEdit(), 0);
      }
    }
  },
  true
);

bookingForm.addEventListener(
  "submit",
  (event) => {
    if (!__labCurrentAuthUser()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showFormMessage(bookingMessage, "请先登录后再创建预约。", "error");
      window.__labOpenAuthDialog?.();
      return;
    }

    if (!__labEditingBookingId) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const existing = bookings.find(
      (booking) => booking.id === __labEditingBookingId
    );
    if (!existing?.canManage) {
      showFormMessage(bookingMessage, "你无权修改这条预约。", "error");
      __labCancelBookingEdit();
      return;
    }

    const updatedBooking = {
      ...existing,
      name: document.querySelector("#bookingName").value.trim(),
      bench: document.querySelector("#benchNumber").value,
      date: bookingDateInput.value,
      startTime: document.querySelector("#startTime").value,
      endTime: document.querySelector("#endTime").value,
      purpose: document.querySelector("#bookingPurpose").value.trim()
    };

    if (!updatedBooking.name) {
      showFormMessage(bookingMessage, "请至少选择一位预约人。", "error");
      return;
    }
    if (!AVAILABLE_BENCHES.includes(updatedBooking.bench)) {
      showFormMessage(bookingMessage, "请选择可预约的超净台。", "error");
      return;
    }
    if (updatedBooking.endTime <= updatedBooking.startTime) {
      showFormMessage(bookingMessage, "结束时间必须晚于开始时间。", "error");
      return;
    }

    const hasConflict = bookings.some(
      (booking) =>
        booking.id !== updatedBooking.id &&
        booking.date === updatedBooking.date &&
        booking.bench === updatedBooking.bench &&
        updatedBooking.startTime < booking.endTime &&
        updatedBooking.endTime > booking.startTime
    );
    if (hasConflict) {
      showFormMessage(
        bookingMessage,
        `${updatedBooking.bench} 在该时间段已经被预约。`,
        "error"
      );
      return;
    }

    bookings = bookings.map((booking) =>
      booking.id === updatedBooking.id ? updatedBooking : booking
    );
    saveData(BOOKING_STORAGE_KEY, bookings);
    visibleWeekStart = getStartOfWeek(parseDateString(updatedBooking.date));
    __labCancelBookingEdit();
    showFormMessage(bookingMessage, "预约修改已提交，正在同步数据库。", "success");
    renderAll();
  },
  true
);

__labBookingCancelEditButton.addEventListener("click", () => {
  __labCancelBookingEdit();
  renderAll();
});

window.addEventListener("lab:auth-changed", () => {
  if (!__labCurrentAuthUser() && __labEditingBookingId) {
    __labCancelBookingEdit();
  }
  __labUpdateBookingAccessUi();
});

window.addEventListener("lab:bookings-refreshed", () => {
  __labUpdateBookingAccessUi();
});

__labUpdateBookingAccessUi();
renderBookings();
