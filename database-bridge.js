const __LAB_BOOKINGS_API_ENDPOINT = "/api/bookings";
const __labOriginalSaveData = saveData;
let __labSyncedBookings = normalizeBookings(bookings).map((booking) => ({ ...booking }));
let __labBookingSyncQueue = Promise.resolve();

async function __labReadResponseError(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return payload.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function __labBookingRequestHeaders(baseHeaders = {}) {
  const authHeaders =
    typeof window.__labGetAuthHeaders === "function"
      ? await window.__labGetAuthHeaders()
      : {};
  return { ...baseHeaders, ...authHeaders };
}

function __labBookingSignature(booking) {
  return JSON.stringify({
    id: booking?.id || "",
    name: booking?.name || "",
    bench: booking?.bench || "",
    date: booking?.date || "",
    startTime: booking?.startTime || "",
    endTime: booking?.endTime || "",
    purpose: booking?.purpose || ""
  });
}

async function __labFetchDatabaseBookings() {
  const response = await fetch(__LAB_BOOKINGS_API_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    headers: await __labBookingRequestHeaders({ Accept: "application/json" })
  });

  if (!response.ok) {
    throw new Error(
      await __labReadResponseError(response, "无法读取数据库中的预约记录。")
    );
  }

  const payload = await response.json();
  return normalizeBookings(payload.bookings || []);
}

async function __labRefreshBookingsFromDatabase() {
  const databaseBookings = await __labFetchDatabaseBookings();
  bookings = databaseBookings;
  __labSyncedBookings = databaseBookings.map((booking) => ({ ...booking }));
  __labOriginalSaveData(BOOKING_STORAGE_KEY, databaseBookings);
  renderAll();
  window.dispatchEvent(
    new CustomEvent("lab:bookings-refreshed", {
      detail: { bookings: databaseBookings }
    })
  );
}

async function __labCreateDatabaseBooking(booking) {
  const response = await fetch(__LAB_BOOKINGS_API_ENDPOINT, {
    method: "POST",
    headers: await __labBookingRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json"
    }),
    body: JSON.stringify(booking)
  });

  if (!response.ok) {
    throw new Error(await __labReadResponseError(response, "预约保存失败。"));
  }

  const payload = await response.json();
  return payload.booking || null;
}

async function __labDeleteDatabaseBooking(id) {
  const response = await fetch(
    `${__LAB_BOOKINGS_API_ENDPOINT}?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: await __labBookingRequestHeaders({ Accept: "application/json" })
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(await __labReadResponseError(response, "预约删除失败。"));
  }
}

async function __labApplyBookingChanges(changedBookings, removedBookings) {
  for (const booking of changedBookings) {
    await __labCreateDatabaseBooking(booking);
  }

  for (const booking of removedBookings) {
    await __labDeleteDatabaseBooking(booking.id);
  }

  await __labRefreshBookingsFromDatabase();
}

saveData = function saveDataWithDatabaseSync(key, data) {
  __labOriginalSaveData(key, data);

  if (key !== BOOKING_STORAGE_KEY) {
    return;
  }

  const nextBookings = normalizeBookings(data).map((booking) => ({ ...booking }));
  const previousBookings = __labSyncedBookings;
  const previousById = new Map(previousBookings.map((booking) => [booking.id, booking]));
  const nextIds = new Set(nextBookings.map((booking) => booking.id));
  const changedBookings = nextBookings.filter((booking) => {
    const previous = previousById.get(booking.id);
    return !previous || __labBookingSignature(previous) !== __labBookingSignature(booking);
  });
  const removedBookings = previousBookings.filter(
    (booking) => !nextIds.has(booking.id)
  );

  __labSyncedBookings = nextBookings;

  if (changedBookings.length === 0 && removedBookings.length === 0) {
    return;
  }

  __labBookingSyncQueue = __labBookingSyncQueue
    .then(() => __labApplyBookingChanges(changedBookings, removedBookings))
    .catch(async (error) => {
      console.error("同步预约数据库失败：", error);

      try {
        await __labRefreshBookingsFromDatabase();
      } catch (refreshError) {
        console.error("重新读取预约数据库失败：", refreshError);
      }

      showFormMessage(
        bookingMessage,
        error.message || "数据库同步失败，请检查连接后重试。",
        "error"
      );
    });
};

function __labQueueDatabaseRefresh() {
  __labBookingSyncQueue = __labBookingSyncQueue
    .then(() => __labRefreshBookingsFromDatabase())
    .catch((error) => {
      console.error("刷新预约数据库失败：", error);
      showFormMessage(
        bookingMessage,
        error.message || "无法连接预约数据库，请检查 DATABASE_URL。",
        "error"
      );
    });
}

window.addEventListener("focus", __labQueueDatabaseRefresh);
window.addEventListener("lab:auth-changed", __labQueueDatabaseRefresh);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    __labQueueDatabaseRefresh();
  }
});
window.setInterval(__labQueueDatabaseRefresh, 30000);

__labQueueDatabaseRefresh();
