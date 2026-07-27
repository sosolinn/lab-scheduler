"use client";

import { useEffect } from "react";

const INITIALIZED_FLAG = "__LAB_SCHEDULER_LEGACY_INITIALIZED__";
const BOOKING_STORAGE_KEY = "labSchedulerBookings";
const BOOKING_API_ENDPOINT = "/api/bookings";

function readLocalBookings() {
  try {
    const value = window.localStorage.getItem(BOOKING_STORAGE_KEY);
    const bookings = value ? JSON.parse(value) : [];
    return Array.isArray(bookings) ? bookings : [];
  } catch (error) {
    console.error("读取本地预约缓存失败：", error);
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
        console.error("连接预约数据库失败，将暂时使用浏览器缓存：", error);
      }

      if (cancelled || window[INITIALIZED_FLAG]) {
        return;
      }

      window[INITIALIZED_FLAG] = true;

      const script = document.createElement("script");
      script.setAttribute("data-lab-scheduler-runtime", "true");
      script.textContent = source;
      document.body.appendChild(script);
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [source]);

  return null;
}
