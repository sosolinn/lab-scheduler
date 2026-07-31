const __LAB_DUTY_TIME_ZONE = "Asia/Shanghai";
const __labLegacyNormalizeDuties = normalizeDuties;

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

function __labDutyTodayString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: __LAB_DUTY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
    hour12: false
  }).format(date);
}

function __labLockDutyDate() {
  const today = __labDutyTodayString();
  dutyDateInput.value = today;
  dutyDateInput.min = today;
  dutyDateInput.max = today;
  dutyDateInput.readOnly = true;
  dutyDateInput.setAttribute("aria-readonly", "true");
  dutyDateInput.title = "值日记录仅能填写当天日期";
}

function __labResetInvalidDutyDate() {
  const today = __labDutyTodayString();
  if (dutyDateInput.value !== today) {
    dutyDateInput.value = today;
    showFormMessage(
      dutyMessage,
      "值日记录仅能在当日填写，不能选择过去或未来日期。",
      "error"
    );
  }
}

dutyDateInput.addEventListener("input", __labResetInvalidDutyDate);
dutyDateInput.addEventListener("change", __labResetInvalidDutyDate);
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
  (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const today = __labDutyTodayString();
    __labLockDutyDate();

    if (dutyDateInput.value !== today) {
      showFormMessage(
        dutyMessage,
        "值日记录仅能在当日填写，不能填写过去或未来日期。",
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
    const submittedAt = new Date().toISOString();
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
  },
  true
);

duties = normalizeDuties(duties);
__labLockDutyDate();
renderAll();
