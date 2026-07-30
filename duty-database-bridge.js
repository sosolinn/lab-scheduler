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
}

async function __labDeleteDatabaseDuty(id) {
  const response = await fetch(
    `${__LAB_DUTIES_API_ENDPOINT}?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(
      await __labReadDutyResponseError(response, "值日记录删除失败。")
    );
  }
}

async function __labRefreshDutiesFromDatabase({ migrateLocal = false } = {}) {
  let databaseDuties = await __labFetchDatabaseDuties();

  if (
    migrateLocal &&
    localStorage.getItem(__LAB_DUTIES_MIGRATION_KEY) !== "1" &&
    databaseDuties.length === 0 &&
    __labSyncedDuties.length > 0
  ) {
    for (const duty of __labSyncedDuties) {
      await __labCreateDatabaseDuty(duty);
    }
    databaseDuties = await __labFetchDatabaseDuties();
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

async function __labApplyDutyChanges(addedDuties, removedDuties) {
  for (const duty of addedDuties) {
    await __labCreateDatabaseDuty(duty);
  }

  for (const duty of removedDuties) {
    await __labDeleteDatabaseDuty(duty.id);
  }

  await __labRefreshDutiesFromDatabase();
}

saveData = function saveDataWithDutyDatabaseSync(key, data) {
  __labDutyOriginalSaveData(key, data);

  if (key !== DUTY_STORAGE_KEY) {
    return;
  }

  const nextDuties = normalizeDuties(data).map((duty) => ({ ...duty }));
  const previousDuties = __labSyncedDuties;
  const previousIds = new Set(previousDuties.map((duty) => duty.id));
  const nextIds = new Set(nextDuties.map((duty) => duty.id));
  const addedDuties = nextDuties.filter((duty) => !previousIds.has(duty.id));
  const removedDuties = previousDuties.filter((duty) => !nextIds.has(duty.id));

  __labSyncedDuties = nextDuties;

  if (addedDuties.length === 0 && removedDuties.length === 0) {
    return;
  }

  __labDutySyncQueue = __labDutySyncQueue
    .then(() => __labApplyDutyChanges(addedDuties, removedDuties))
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
