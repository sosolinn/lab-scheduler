const __LAB_DUTIES_API_ENDPOINT = "/api/duties";
const __LAB_DUTIES_MIGRATION_KEY = "labSchedulerDutiesMigratedToDatabase";
const __labDutyOriginalSaveData = saveData;
let __labSyncedDuties = normalizeDuties(duties).map((duty) => ({ ...duty }));
let __labDutySyncQueue = Promise.resolve();

async function __labReadDutyResponseError(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return payload.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function __labFetchDatabaseDuties() {
  const response = await fetch(__LAB_DUTIES_API_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      await __labReadDutyResponseError(response, "无法读取数据库中的值日记录。")
    );
  }

  const payload = await response.json();
  return normalizeDuties(payload.duties || []);
}

async function __labCreateDatabaseDuty(duty) {
  const response = await fetch(__LAB_DUTIES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(duty)
  });

  if (!response.ok) {
    throw new Error(
      await __labReadDutyResponseError(response, "值日记录保存失败。")
    );
  }

  const payload = await response.json();
  return payload.duty || null;
}

function __labDutySignature(duty) {
  return JSON.stringify({
    id: duty?.id || "",
    name: duty?.name || "",
    names: Array.isArray(duty?.names) ? duty.names : [],
    date: duty?.date || "",
    checkedItems: Array.isArray(duty?.checkedItems) ? duty.checkedItems : [],
    abnormal: duty?.abnormal || "",
    legacyTask: duty?.legacyTask || "",
    legacyNote: duty?.legacyNote || "",
    submittedAt: duty?.submittedAt || ""
  });
}

async function __labRefreshDutiesFromDatabase({ migrateLocal = false } = {}) {
  let databaseDuties = await __labFetchDatabaseDuties();

  if (
    migrateLocal &&
    localStorage.getItem(__LAB_DUTIES_MIGRATION_KEY) !== "1" &&
    databaseDuties.length === 0 &&
    __labSyncedDuties.length > 0
  ) {
    const today = getTodayString();
    const todayDuties = __labSyncedDuties
      .filter((duty) => duty.date === today)
      .sort((a, b) =>
        (a.submittedAt || a.createdAt || "").localeCompare(
          b.submittedAt || b.createdAt || ""
        )
      );
    const latestTodayDuty = todayDuties.at(-1);

    if (latestTodayDuty) {
      await __labCreateDatabaseDuty(latestTodayDuty);
      databaseDuties = await __labFetchDatabaseDuties();
    }
  }

  localStorage.setItem(__LAB_DUTIES_MIGRATION_KEY, "1");
  duties = databaseDuties;
  __labSyncedDuties = databaseDuties.map((duty) => ({ ...duty }));
  __labDutyOriginalSaveData(DUTY_STORAGE_KEY, databaseDuties);
  renderAll();
  window.dispatchEvent(
    new CustomEvent("lab:duties-refreshed", {
      detail: { duties: databaseDuties }
    })
  );
}

async function __labApplyDutyChanges(changedDuties) {
  for (const duty of changedDuties) {
    await __labCreateDatabaseDuty(duty);
  }

  await __labRefreshDutiesFromDatabase();
}

saveData = function saveDataWithDutyDatabaseSync(key, data) {
  __labDutyOriginalSaveData(key, data);

  if (key !== DUTY_STORAGE_KEY) {
    return;
  }

  const nextDuties = normalizeDuties(data).map((duty) => ({ ...duty }));
  const previousByDate = new Map(
    __labSyncedDuties.map((duty) => [duty.date, duty])
  );
  const changedDuties = nextDuties.filter((duty) => {
    const previousDuty = previousByDate.get(duty.date);
    return __labDutySignature(previousDuty) !== __labDutySignature(duty);
  });

  __labSyncedDuties = nextDuties;

  if (changedDuties.length === 0) {
    return;
  }

  __labDutySyncQueue = __labDutySyncQueue
    .then(() => __labApplyDutyChanges(changedDuties))
    .catch(async (error) => {
      console.error("同步值日数据库失败：", error);

      try {
        await __labRefreshDutiesFromDatabase();
      } catch (refreshError) {
        console.error("重新读取值日数据库失败：", refreshError);
      }

      showFormMessage(
        dutyMessage,
        error.message || "值日数据库同步失败，请检查连接后重试。",
        "error"
      );
    });
};

function __labQueueDutyDatabaseRefresh(options) {
  __labDutySyncQueue = __labDutySyncQueue
    .then(() => __labRefreshDutiesFromDatabase(options))
    .catch((error) => {
      console.error("刷新值日数据库失败：", error);
    });
}

window.addEventListener("focus", () => __labQueueDutyDatabaseRefresh());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    __labQueueDutyDatabaseRefresh();
  }
});
window.setInterval(() => __labQueueDutyDatabaseRefresh(), 30000);

__labQueueDutyDatabaseRefresh({ migrateLocal: true });
