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

async function __labFetchDatabaseBookings() {
  const response = await fetch(__LAB_BOOKINGS_API_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
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
}

async function __labCreateDatabaseBooking(booking) {
  const response = await fetch(__LAB_BOOKINGS_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(booking)
  });

  if (!response.ok) {
    throw new Error(await __labReadResponseError(response, "预约保存失败。"));
  }
}

async function __labDeleteDatabaseBooking(id) {
  const response = await fetch(
    `${__LAB_BOOKINGS_API_ENDPOINT}?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(await __labReadResponseError(response, "预约删除失败。"));
  }
}

async function __labApplyBookingChanges(addedBookings, removedBookings) {
  for (const booking of addedBookings) {
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
  const previousIds = new Set(previousBookings.map((booking) => booking.id));
  const nextIds = new Set(nextBookings.map((booking) => booking.id));
  const addedBookings = nextBookings.filter((booking) => !previousIds.has(booking.id));
  const removedBookings = previousBookings.filter((booking) => !nextIds.has(booking.id));

  __labSyncedBookings = nextBookings;

  if (addedBookings.length === 0 && removedBookings.length === 0) {
    return;
  }

  __labBookingSyncQueue = __labBookingSyncQueue
    .then(() => __labApplyBookingChanges(addedBookings, removedBookings))
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
    });
}

window.addEventListener("focus", __labQueueDatabaseRefresh);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    __labQueueDatabaseRefresh();
  }
});
window.setInterval(__labQueueDatabaseRefresh, 30000);
