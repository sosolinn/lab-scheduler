"use client";

import { useEffect } from "react";

const INITIALIZED_FLAG = "__LAB_SCHEDULER_LEGACY_INITIALIZED__";
const BOOKING_STORAGE_KEY = "labSchedulerBookings";
const BOOKING_API_ENDPOINT = "/api/bookings";
const PIPETTE_TIPS_CHECK_TEXT = "插好 5 mL 与 10 μL 枪头";
const CELL_ROOM_MOPPING_CHECK_TEXT = "细胞房拖地清洁";

function readLocalBookings() {
  try {
    const value = window.localStorage.getItem(BOOKING_STORAGE_KEY);
    const bookings = value ? JSON.parse(value) : [];
    return Array.isArray(bookings) ? bookings : [];
  } catch (error) {
    console.warn("读取本地预约缓存失败：", error);
    return [];
  }
}

async function readResponseError(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return payload.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function fetchDatabaseBookings() {
  const response = await fetch(BOOKING_API_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(await readResponseError(response, "无法读取数据库预约记录。"));
  }

  const payload = await response.json();
  return Array.isArray(payload.bookings) ? payload.bookings : [];
}

async function migrateLocalBookings(localBookings, databaseBookings) {
  const databaseIds = new Set(databaseBookings.map((booking) => booking.id));

  for (const booking of localBookings) {
    if (!booking?.id || databaseIds.has(booking.id)) {
      continue;
    }

    const response = await fetch(BOOKING_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(booking)
    });

    if (!response.ok && response.status !== 409) {
      console.warn(
        "迁移本地预约记录失败：",
        await readResponseError(response, "未知错误")
      );
    }
  }
}

async function hydrateBookingsFromDatabase() {
  const localBookings = readLocalBookings();
  let databaseBookings = await fetchDatabaseBookings();

  if (localBookings.length > 0) {
    await migrateLocalBookings(localBookings, databaseBookings);
    databaseBookings = await fetchDatabaseBookings();
  }

  window.localStorage.setItem(
    BOOKING_STORAGE_KEY,
    JSON.stringify(databaseBookings)
  );
}

function createDutyOption(value) {
  const option = document.createElement("label");
  option.className = "duty-check-option";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "duty-check-input";
  input.name = "dutyCheck";
  input.value = value;

  const text = document.createElement("span");
  text.textContent = value;

  option.append(input, text);
  return option;
}

function ensurePipetteTipsMarkup() {
  if (
    document.querySelector(
      `input[name="dutyCheck"][value="${PIPETTE_TIPS_CHECK_TEXT}"]`
    )
  ) {
    return;
  }

  const pipetteInput = document.querySelector(
    'input[name="dutyCheck"][value="移液器已归位"]'
  );
  const pipetteOption = pipetteInput?.closest("label.duty-check-option");

  if (!pipetteOption) {
    return;
  }

  pipetteOption.insertAdjacentElement(
    "afterend",
    createDutyOption(PIPETTE_TIPS_CHECK_TEXT)
  );
}

function ensureCellRoomMoppingMarkup() {
  if (
    document.querySelector(
      `input[name="dutyCheck"][value="${CELL_ROOM_MOPPING_CHECK_TEXT}"]`
    )
  ) {
    return;
  }

  const checklist = document.querySelector("#dutyForm .duty-checklist");
  if (!checklist) {
    return;
  }

  const group = document.createElement("fieldset");
  group.className = "duty-check-group duty-priority-group";
  group.setAttribute(
    "aria-label",
    `7. 值日重点：${CELL_ROOM_MOPPING_CHECK_TEXT}`
  );

  const priorityOption = createDutyOption(CELL_ROOM_MOPPING_CHECK_TEXT);
  priorityOption.classList.add("duty-priority-option");
  group.appendChild(priorityOption);
  checklist.appendChild(group);

  const abnormalLabel = document.querySelector(
    'label[for="dutyAbnormal"]'
  );
  if (abnormalLabel) {
    abnormalLabel.textContent = "异常记录";
  }
}

function ensureDutyChecklistMarkup() {
  ensurePipetteTipsMarkup();
  ensureCellRoomMoppingMarkup();

  const selectionCount = document.querySelector("#dutySelectionCount");
  if (selectionCount) {
    selectionCount.textContent = selectionCount.textContent.replace(
      /\/\d+ 项$/,
      "/18 项"
    );
  }
}

function ensurePipetteTipsSource(source) {
  if (source.includes(`"${PIPETTE_TIPS_CHECK_TEXT}"`)) {
    return source;
  }

  return source.replace(
    /("移液器已归位",)(\s*)"液氮罐液氮充足"/,
    (match, pipetteItem, spacing) =>
      `${pipetteItem}${spacing}"${PIPETTE_TIPS_CHECK_TEXT}",${spacing}"液氮罐液氮充足"`
  );
}

function ensureCellRoomMoppingSource(source) {
  if (source.includes(`"${CELL_ROOM_MOPPING_CHECK_TEXT}"`)) {
    return source;
  }

  return source.replace(
    /(\{\s*title:\s*"6\. 废弃物处理",\s*items:\s*\["废液桶和垃圾袋未过满、无泄漏"\]\s*\})(\s*\];)/,
    `$1,\n  {\n    title: "7. 值日重点",\n    items: ["${CELL_ROOM_MOPPING_CHECK_TEXT}"]\n  }$2`
  );
}

function ensureDutyChecklistSource(source) {
  return ensureCellRoomMoppingSource(ensurePipetteTipsSource(source));
}

function downgradeRecoverableDatabaseLogs(source) {
  const recoverableLogs = [
    ["console.error(`添加${labelText}失败：`, error);", "console.warn(`添加${labelText}失败：`, error);"],
    ["console.error(`删除${labelText}失败：`, error);", "console.warn(`删除${labelText}失败：`, error);"],
    ["console.error(`刷新${labelText}名单失败：`, error);", "console.warn(`刷新${labelText}名单失败：`, error);"],
    ["console.error(`初始化${labelText}名单失败：`, error);", "console.warn(`初始化${labelText}名单失败：`, error);"]
  ];

  return recoverableLogs.reduce(
    (result, [from, to]) => result.replaceAll(from, to),
    source
  );
}

export default function LegacyScriptRunner({ source }) {
  useEffect(() => {
    if (window[INITIALIZED_FLAG]) {
      return;
    }

    let cancelled = false;

    async function initialize() {
      try {
        await hydrateBookingsFromDatabase();
      } catch (error) {
        console.warn("连接预约数据库失败，将暂时使用浏览器缓存：", error);
      }

      if (cancelled || window[INITIALIZED_FLAG]) {
        return;
      }

      window[INITIALIZED_FLAG] = true;
      ensureDutyChecklistMarkup();

      const script = document.createElement("script");
      script.setAttribute("data-lab-scheduler-runtime", "true");
      script.textContent = downgradeRecoverableDatabaseLogs(
        ensureDutyChecklistSource(source)
      );
      document.body.appendChild(script);
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [source]);

  return null;
}
