import { randomUUID } from "node:crypto";

import { getDatabase } from "../../../lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
let schemaPromise;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function normalizeText(value, maximumLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maximumLength);
}

function normalizeName(value) {
  return normalizeText(value, 30).replace(/\s+/g, " ");
}

function uniqueNames(values) {
  const seen = new Set();

  return values.filter((value) => {
    const key = value.toLocaleLowerCase("zh-CN");
    if (!value || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeNames(payload) {
  const source = Array.isArray(payload?.names)
    ? payload.names
    : String(payload?.name || "").split(/[、,，;；/]+/);

  return uniqueNames(source.map(normalizeName).filter(Boolean)).slice(0, 20);
}

function normalizeStringArray(value, maximumItems = 64, maximumLength = 160) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item, maximumLength))
    .filter(Boolean)
    .slice(0, maximumItems);
}

function parseStoredArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateDutyPayload(payload) {
  const names = normalizeNames(payload);
  const duty = {
    id: normalizeText(payload?.id, 100) || randomUUID(),
    names,
    name: names.join("、"),
    date: normalizeText(payload?.date, 10),
    checkedItems: normalizeStringArray(payload?.checkedItems),
    abnormal: normalizeText(payload?.abnormal, 2000),
    legacyTask: normalizeText(payload?.legacyTask, 1000),
    legacyNote: normalizeText(payload?.legacyNote, 1000),
    createdAt: normalizeText(payload?.createdAt, 60)
  };

  if (duty.names.length === 0) {
    return { error: "请至少选择一位值日人。" };
  }
  if (!isValidDate(duty.date)) {
    return { error: "值日日期格式不正确。" };
  }
  if (
    duty.checkedItems.length === 0 &&
    !duty.abnormal &&
    !duty.legacyTask &&
    !duty.legacyNote
  ) {
    return { error: "请至少勾选一项值日内容，或填写异常记录。" };
  }

  return { duty };
}

function mapDuty(row) {
  const names = parseStoredArray(row.namesJson).map(normalizeName).filter(Boolean);

  return {
    id: row.id,
    names,
    name: row.name || names.join("、") || "未填写",
    date: row.date,
    checkedItems: parseStoredArray(row.checkedItemsJson),
    abnormal: row.abnormal || "",
    legacyTask: row.legacyTask || "",
    legacyNote: row.legacyNote || "",
    createdAt: row.createdAt || ""
  };
}

async function ensureDutiesTable() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getDatabase();

      await sql`
        create table if not exists lab_duties (
          id text primary key,
          name text not null,
          names_json text not null default '[]',
          duty_date date not null,
          checked_items_json text not null default '[]',
          abnormal text not null default '',
          legacy_task text not null default '',
          legacy_note text not null default '',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;

      await sql`
        create index if not exists lab_duties_date_idx
        on lab_duties (duty_date desc, created_at desc)
      `;
    })();
  }

  try {
    await schemaPromise;
  } catch (error) {
    schemaPromise = undefined;
    throw error;
  }
}

async function selectDuties(sql) {
  const rows = await sql`
    select
      id,
      name,
      names_json as "namesJson",
      duty_date::text as date,
      checked_items_json as "checkedItemsJson",
      abnormal,
      legacy_task as "legacyTask",
      legacy_note as "legacyNote",
      created_at::text as "createdAt"
    from lab_duties
    order by duty_date desc, created_at desc
  `;

  return rows.map(mapDuty);
}

export async function GET() {
  try {
    await ensureDutiesTable();
    const sql = getDatabase();
    return json({ duties: await selectDuties(sql) });
  } catch (error) {
    console.error("读取值日数据库失败：", error);
    return json({ error: "无法读取值日记录，请检查数据库连接。" }, 500);
  }
}

export async function POST(request) {
  try {
    await ensureDutiesTable();

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "请求内容不是有效的 JSON。" }, 400);
    }

    const validation = validateDutyPayload(payload);
    if (validation.error) {
      return json({ error: validation.error }, 400);
    }

    const duty = validation.duty;
    const sql = getDatabase();
    const createdAt = duty.createdAt ? new Date(duty.createdAt) : new Date();
    const safeCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;

    const [row] = await sql`
      insert into lab_duties (
        id,
        name,
        names_json,
        duty_date,
        checked_items_json,
        abnormal,
        legacy_task,
        legacy_note,
        created_at
      ) values (
        ${duty.id},
        ${duty.name},
        ${JSON.stringify(duty.names)},
        ${duty.date}::date,
        ${JSON.stringify(duty.checkedItems)},
        ${duty.abnormal},
        ${duty.legacyTask},
        ${duty.legacyNote},
        ${safeCreatedAt.toISOString()}::timestamptz
      )
      on conflict (id) do update set
        name = excluded.name,
        names_json = excluded.names_json,
        duty_date = excluded.duty_date,
        checked_items_json = excluded.checked_items_json,
        abnormal = excluded.abnormal,
        legacy_task = excluded.legacy_task,
        legacy_note = excluded.legacy_note,
        updated_at = now()
      returning
        id,
        name,
        names_json as "namesJson",
        duty_date::text as date,
        checked_items_json as "checkedItemsJson",
        abnormal,
        legacy_task as "legacyTask",
        legacy_note as "legacyNote",
        created_at::text as "createdAt"
    `;

    return json({ duty: mapDuty(row) }, 201);
  } catch (error) {
    console.error("保存值日数据库失败：", error);
    return json({ error: "值日记录保存失败，请检查数据库连接。" }, 500);
  }
}

export async function DELETE(request) {
  try {
    await ensureDutiesTable();

    const id = normalizeText(new URL(request.url).searchParams.get("id"), 100);
    if (!id) {
      return json({ error: "缺少值日记录 ID。" }, 400);
    }

    const sql = getDatabase();
    const deletedRows = await sql`
      delete from lab_duties
      where id = ${id}
      returning id
    `;

    if (deletedRows.length === 0) {
      return json({ error: "值日记录不存在或已被删除。" }, 404);
    }

    return json({ success: true });
  } catch (error) {
    console.error("删除值日数据库记录失败：", error);
    return json({ error: "值日记录删除失败，请检查数据库连接。" }, 500);
  }
}
