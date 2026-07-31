"use client";

import { useEffect } from "react";

const INITIALIZED_FLAG = "__LAB_SCHEDULER_LEGACY_INITIALIZED__";
const BOOKING_STORAGE_KEY = "labSchedulerBookings";
const BOOKING_API_ENDPOINT = "/api/bookings";
const PIPETTE_TIPS_CHECK_TEXT = "插好 5 mL 与 10 μL 枪头";

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

function ensurePipetteTipsMarkup() {
  const selectionCount = document.querySelector("#dutySelectionCount");
  if (selectionCount) {
    selectionCount.textContent = selectionCount.textContent.replace(
      /\/\d+ 项$/,
      "/17 项"
    );
  }

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

  const tipsOption = document.createElement("label");
  tipsOption.className = "duty-check-option";

  const tipsInput = document.createElement("input");
  tipsInput.type = "checkbox";
  tipsInput.className = "duty-check-input";
  tipsInput.name = "dutyCheck";
  tipsInput.value = PIPETTE_TIPS_CHECK_TEXT;

  const tipsText = document.createElement("span");
  tipsText.textContent = PIPETTE_TIPS_CHECK_TEXT;

  tipsOption.append(tipsInput, tipsText);
  pipetteOption.insertAdjacentElement("afterend", tipsOption);
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
      ensurePipetteTipsMarkup();

      const script = document.createElement("script");
      script.setAttribute("data-lab-scheduler-runtime", "true");
      script.textContent = downgradeRecoverableDatabaseLogs(
        ensurePipetteTipsSource(source)
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
