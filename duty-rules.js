const __LAB_DUTY_TIME_ZONE = "Asia/Shanghai";
const __LAB_BEIJING_TIME_ENDPOINT = "/api/beijing-time";
const __labLegacyNormalizeDuties = normalizeDuties;
const __labDutySubmitButton = dutyForm.querySelector('button[type="submit"]');
let __labBeijingClockOffset = null;
let __labBeijingTimeSyncPromise = null;
let __labBeijingLastSyncedAt = 0;
let __labDutySubmitting = false;

normalizeDuties = function normalizeDutiesWithSubmissionTime(data) {
  const source = Array.isArray(data) ? data : [];
  const normalized = __labLegacyNormalizeDuties(source);

  return normalized.map((duty, index) => {
    const original = source[index] || {};
    return {
      ...duty,
      names: Array.isArray(original.names) ? original.names : duty.names,
      createdAt: original.createdAt || duty.createdAt || "",
      submittedAt:
        original.submittedAt ||
        original.updatedAt ||
        original.createdAt ||
        duty.createdAt ||
        ""
    };
  });
};

function __labGetTimeZoneParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: __LAB_DUTY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function __labGetBeijingNow() {
  if (!Number.isFinite(__labBeijingClockOffset)) {
    return null;
  }
  return new Date(Date.now() + __labBeijingClockOffset);
}

function __labDutyTodayString() {
  const now = __labGetBeijingNow();
  if (!now) {
    return "";
  }
  const values = __labGetTimeZoneParts(now);
  return `${values.year}-${values.month}-${values.day}`;
}

function __labFormatBeijingClock(date) {
  const values = __labGetTimeZoneParts(date);
  return `${values.year}/${values.month}/${values.day} ${values.hour}:${values.minute}`;
}

function __labFormatDutySubmissionTime(value) {
  if (!value) {
    return "未记录";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: __LAB_DUTY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

const __labDutyTimeStatus = document.createElement("p");
__labDutyTimeStatus.id = "dutyBeijingTimeStatus";
__labDutyTimeStatus.className = "duty-time-status syncing";
__labDutyTimeStatus.textContent = "正在从服务端同步北京时间…";
dutyDateInput.insertAdjacentElement("afterend", __labDutyTimeStatus);
dutyDateInput.setAttribute("aria-describedby", __labDutyTimeStatus.id);

function __labUpdateDutySubmitAvailability() {
  if (__labDutySubmitButton) {
    __labDutySubmitButton.disabled =
      __labDutySubmitting || !Number.isFinite(__labBeijingClockOffset);
  }
}

function __labLockDutyDate() {
  const today = __labDutyTodayString();
  dutyDateInput.readOnly = true;
  dutyDateInput.setAttribute("aria-readonly", "true");
  dutyDateInput.title = "值日日期由服务端北京时间自动确定";

  if (!today) {
    dutyDateInput.value = "";
    dutyDateInput.removeAttribute("min");
    dutyDateInput.removeAttribute("max");
    return;
  }

  dutyDateInput.value = today;
  dutyDateInput.min = today;
  dutyDateInput.max = today;
}

function __labRenderBeijingTimeStatus() {
  const now = __labGetBeijingNow();
  if (!now) {
    return;
  }

  __labLockDutyDate();
  const age = Date.now() - __labBeijingLastSyncedAt;
  __labDutyTimeStatus.className = `duty-time-status${age > 15 * 60 * 1000 ? " stale" : " synced"}`;
  __labDutyTimeStatus.textContent = `北京时间：${__labFormatBeijingClock(now)}（服务端校准）`;
}

async function __labSyncBeijingTime({ force = false } = {}) {
  if (__labBeijingTimeSyncPromise) {
    return __labBeijingTimeSyncPromise;
  }

  if (
    !force &&
    Number.isFinite(__labBeijingClockOffset) &&
    Date.now() - __labBeijingLastSyncedAt < 5 * 60 * 1000
  ) {
    __labRenderBeijingTimeStatus();
    return;
  }

  const hadSynchronizedTime = Number.isFinite(__labBeijingClockOffset);
  if (!hadSynchronizedTime) {
    __labDutyTimeStatus.className = "duty-time-status syncing";
    __labDutyTimeStatus.textContent = "正在从服务端同步北京时间…";
    __labUpdateDutySubmitAvailability();
  }

  __labBeijingTimeSyncPromise = (async () => {
    const requestStartedAt = Date.now();
    const response = await fetch(__LAB_BEIJING_TIME_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    const responseReceivedAt = Date.now();

    if (!response.ok) {
      throw new Error("北京时间同步服务暂不可用。");
    }

    const payload = await response.json();
    const serverEpochMs = Number(payload.epochMs);
    if (!Number.isFinite(serverEpochMs)) {
      throw new Error("北京时间同步结果无效。");
    }

    const localMidpoint = (requestStartedAt + responseReceivedAt) / 2;
    __labBeijingClockOffset = serverEpochMs - localMidpoint;
    __labBeijingLastSyncedAt = Date.now();
    __labLockDutyDate();
    __labRenderBeijingTimeStatus();
    __labUpdateDutySubmitAvailability();
  })()
    .catch((error) => {
      console.error("同步北京时间失败：", error);
      if (!hadSynchronizedTime && !Number.isFinite(__labBeijingClockOffset)) {
        dutyDateInput.value = "";
        __labDutyTimeStatus.className = "duty-time-status error";
        __labDutyTimeStatus.textContent = "北京时间同步失败，暂不能提交值日记录。";
        __labUpdateDutySubmitAvailability();
      } else {
        __labDutyTimeStatus.className = "duty-time-status stale";
        __labDutyTimeStatus.textContent = "北京时间重新同步失败，正在使用最近一次校准结果。";
      }
      throw error;
    })
    .finally(() => {
      __labBeijingTimeSyncPromise = null;
    });

  return __labBeijingTimeSyncPromise;
}

function __labResetInvalidDutyDate() {
  const today = __labDutyTodayString();
  if (today && dutyDateInput.value !== today) {
    dutyDateInput.value = today;
    showFormMessage(
      dutyMessage,
      "值日日期由服务端北京时间确定，不能填写过去或未来日期。",
      "error"
    );
  }
}

dutyDateInput.addEventListener("input", __labResetInvalidDutyDate);
dutyDateInput.addEventListener("change", __labResetInvalidDutyDate);
dutyDateInput.addEventListener("pointerdown", (event) => event.preventDefault());
dutyDateInput.addEventListener("keydown", (event) => event.preventDefault());
dutyForm.addEventListener("reset", () => {
  window.setTimeout(__labLockDutyDate, 0);
});

const __labLegacyRenderDuties = renderDuties;
renderDuties = function renderDutiesWithoutDeletion() {
  const result = __labLegacyRenderDuties();
  const sortedDuties = sortDuties(duties);
  const recordItems = Array.from(dutyList.querySelectorAll(".duty-record-item"));

  recordItems.forEach((recordItem, index) => {
    recordItem.querySelector("[data-delete-duty]")?.remove();

    const duty = sortedDuties[index];
    const summary = recordItem.querySelector(".duty-record-summary");
    if (!duty || !summary || summary.querySelector(".duty-submission-time")) {
      return;
    }

    const submissionTime = document.createElement("div");
    submissionTime.className = "duty-submission-time";
    submissionTime.innerHTML = `<strong>提交时间：</strong>${escapeHtml(
      __labFormatDutySubmissionTime(duty.submittedAt || duty.createdAt)
    )}`;

    const dateLine = summary.firstElementChild;
    if (dateLine) {
      dateLine.insertAdjacentElement("afterend", submissionTime);
    } else {
      summary.prepend(submissionTime);
    }
  });

  return result;
};

dutyList.addEventListener(
  "click",
  (event) => {
    if (event.target.closest("[data-delete-duty]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showFormMessage(
        dutyMessage,
        "值日记录不能删除；当日需要修正时，请重新提交覆盖当天记录。",
        "error"
      );
    }
  },
  true
);

dutyForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (__labDutySubmitting) {
      return;
    }

    __labDutySubmitting = true;
    __labUpdateDutySubmitAvailability();

    try {
      try {
        await __labSyncBeijingTime({ force: true });
      } catch {
        if (!Number.isFinite(__labBeijingClockOffset)) {
          showFormMessage(
            dutyMessage,
            "无法同步北京时间，暂不能提交值日记录。请检查网络后重试。",
            "error"
          );
          return;
        }
      }

      const today = __labDutyTodayString();
      __labLockDutyDate();

      if (!today || dutyDateInput.value !== today) {
        showFormMessage(
          dutyMessage,
          "值日记录仅能按当前北京时间填写。",
          "error"
        );
        return;
      }

      const checkedItems = dutyCheckboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value);
      const abnormal = document.querySelector("#dutyAbnormal").value.trim();
      const name = document.querySelector("#dutyName").value.trim();

      if (!name) {
        showFormMessage(dutyMessage, "请至少选择一位值日人。", "error");
        return;
      }

      if (checkedItems.length === 0 && !abnormal) {
        showFormMessage(
          dutyMessage,
          "请至少勾选一项值日内容，或填写异常记录。",
          "error"
        );
        return;
      }

      const existingDuty = duties.find((duty) => duty.date === today);
      const authoritativeNow = __labGetBeijingNow();
      const submittedAt = authoritativeNow
        ? authoritativeNow.toISOString()
        : new Date().toISOString();
      const names = name
        .split(/[、,，;；/]+/)
        .map((person) => person.trim())
        .filter(Boolean);
      const duty = {
        id: existingDuty?.id || createId(),
        names,
        name,
        date: today,
        checkedItems,
        abnormal,
        legacyTask: "",
        legacyNote: "",
        createdAt: existingDuty?.createdAt || submittedAt,
        submittedAt
      };

      duties = [duty, ...duties.filter((item) => item.date !== today)];
      saveData(DUTY_STORAGE_KEY, duties);
      dutyForm.reset();
      __labLockDutyDate();
      updateDutySelectionCount();
      showFormMessage(
        dutyMessage,
        existingDuty
          ? `今日值日记录已覆盖，已勾选 ${checkedItems.length}/${ALL_DUTY_ITEMS.length} 项。`
          : `值日记录保存成功，已勾选 ${checkedItems.length}/${ALL_DUTY_ITEMS.length} 项。`,
        "success"
      );
      renderAll();
    } finally {
      __labDutySubmitting = false;
      __labUpdateDutySubmitAvailability();
    }
  },
  true
);

window.addEventListener("focus", () => {
  __labSyncBeijingTime({ force: true }).catch(() => {});
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    __labSyncBeijingTime({ force: true }).catch(() => {});
  }
});
window.setInterval(__labRenderBeijingTimeStatus, 30000);
window.setInterval(
  () => __labSyncBeijingTime({ force: true }).catch(() => {}),
  10 * 60 * 1000
);

duties = normalizeDuties(duties);
dutyDateInput.value = "";
__labLockDutyDate();
__labUpdateDutySubmitAvailability();
renderAll();
__labSyncBeijingTime({ force: true }).catch(() => {});
