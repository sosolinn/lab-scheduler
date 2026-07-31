const __LAB_DUTIES_API_ENDPOINT = "/api/duties";
const __LAB_DUTIES_TIME_ENDPOINT = "/api/beijing-time";
const __LAB_DUTIES_MIGRATION_KEY = "labSchedulerDutiesMigratedToDatabase";
const __labDutyOriginalSaveData = saveData;
let __labSyncedDuties = normalizeDuties(duties).map((duty) => ({ ...duty }));
let __labDutySyncQueue = Promise.resolve();
let __labDutyDatabaseWarningShown = false;

async function __labReadDutyResponseError(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return payload.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function __labDutyRequestHeaders(baseHeaders = {}) {
  try {
    await window.__labAuthReady;
  } catch {
    // 身份初始化失败时仍允许读取公开值日记录，写入会由服务端拒绝。
  }

  const authHeaders =
    typeof window.__labGetAuthHeaders === "function"
      ? await window.__labGetAuthHeaders()
      : {};
  return { ...baseHeaders, ...authHeaders };
}

function __labDutyHasAuthenticatedUser() {
  return Boolean(window.__labGetAuthState?.().user);
}

function __labReportDutyDatabaseUnavailable(error, context) {
  const message = error?.message || "值日数据库暂时不可用。";

  if (!__labDutyDatabaseWarningShown) {
    console.warn(`${context}：${message}`);
    __labDutyDatabaseWarningShown = true;
  }

  return message;
}

function __labMarkDutyDatabaseAvailable() {
  __labDutyDatabaseWarningShown = false;
}

async function __labFetchDatabaseDuties() {
  const response = await fetch(__LAB_DUTIES_API_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(
      await __labReadDutyResponseError(response, "无法读取数据库中的值日记录。")
    );
  }

  const payload = await response.json();
  return normalizeDuties(payload.duties || []);
}

async function __labFetchServerBeijingDate() {
  const response = await fetch(__LAB_DUTIES_TIME_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error("无法读取服务端北京时间。");
  }

  const payload = await response.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date || "")) {
    throw new Error("服务端北京时间格式不正确。");
  }
  return payload.date;
}

async function __labCreateDatabaseDuty(duty) {
  const response = await fetch(__LAB_DUTIES_API_ENDPOINT, {
    method: "POST",
    headers: await __labDutyRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json"
    }),
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
  const migrationAlreadyCompleted =
    localStorage.getItem(__LAB_DUTIES_MIGRATION_KEY) === "1";
  const hasLocalDuties = __labSyncedDuties.length > 0;
  const shouldConsiderMigration =
    migrateLocal &&
    !migrationAlreadyCompleted &&
    databaseDuties.length === 0 &&
    hasLocalDuties;

  if (shouldConsiderMigration) {
    try {
      await window.__labAuthReady;
    } catch {
      // 登录初始化失败时保留迁移标记，等待下一次登录后再处理。
    }

    if (__labDutyHasAuthenticatedUser()) {
      const today = await __labFetchServerBeijingDate();
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
      localStorage.setItem(__LAB_DUTIES_MIGRATION_KEY, "1");
    }
  } else if (migrateLocal && !migrationAlreadyCompleted) {
    localStorage.setItem(__LAB_DUTIES_MIGRATION_KEY, "1");
  }

  __labMarkDutyDatabaseAvailable();
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
    .catch((error) => {
      const message = __labReportDutyDatabaseUnavailable(
        error,
        "同步值日数据库失败"
      );

      showFormMessage(
        dutyMessage,
        `${message} 本次修改已暂存在当前浏览器，登录并恢复连接后请重新提交。`,
        "error"
      );
    });
};

function __labQueueDutyDatabaseRefresh(options) {
  __labDutySyncQueue = __labDutySyncQueue
    .then(() => __labRefreshDutiesFromDatabase(options))
    .catch((error) => {
      __labReportDutyDatabaseUnavailable(error, "刷新值日数据库失败");
    });
}

window.addEventListener("focus", () => __labQueueDutyDatabaseRefresh());
window.addEventListener("lab:auth-changed", () =>
  __labQueueDutyDatabaseRefresh({ migrateLocal: true })
);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    __labQueueDutyDatabaseRefresh();
  }
});
window.setInterval(() => __labQueueDutyDatabaseRefresh(), 30000);

__labQueueDutyDatabaseRefresh({ migrateLocal: true });
