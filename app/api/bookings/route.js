import { randomUUID } from "node:crypto";

import { getDatabase } from "../../../lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_BENCHES = new Set(["超净台1（动物）", "超净台2（细胞）"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function validateBookingPayload(payload) {
  const booking = {
    id: normalizeText(payload?.id, 100) || randomUUID(),
    name: normalizeText(payload?.name, 80),
    bench: normalizeText(payload?.bench, 40),
    date: normalizeText(payload?.date, 10),
    startTime: normalizeText(payload?.startTime, 5),
    endTime: normalizeText(payload?.endTime, 5),
    purpose: normalizeText(payload?.purpose, 500)
  };

  if (!booking.name) {
    return { error: "请输入预约人姓名。" };
  }
  if (!ALLOWED_BENCHES.has(booking.bench)) {
    return { error: "请选择可预约的超净台。" };
  }
  if (!isValidDate(booking.date)) {
    return { error: "预约日期格式不正确。" };
  }
  if (!TIME_PATTERN.test(booking.startTime) || !TIME_PATTERN.test(booking.endTime)) {
    return { error: "预约时间格式不正确。" };
  }
  if (booking.endTime <= booking.startTime) {
    return { error: "结束时间必须晚于开始时间。" };
  }

  return { booking };
}

function mapBooking(row) {
  return {
    id: row.id,
    name: row.name,
    bench: row.bench,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    purpose: row.purpose || ""
  };
}

async function ensureBookingsTable() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getDatabase();

      await sql`
        create table if not exists lab_bookings (
          id text primary key,
          name text not null,
          bench text not null check (bench in ('超净台1（动物）', '超净台2（细胞）')),
          booking_date date not null,
          start_time time not null,
          end_time time not null,
          purpose text not null default '',
          created_at timestamptz not null default now(),
          constraint lab_bookings_valid_time check (end_time > start_time)
        )
      `;

      await sql`
        create index if not exists lab_bookings_date_bench_idx
        on lab_bookings (booking_date, bench, start_time)
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

async function selectBookings(sql) {
  const rows = await sql`
    select
      id,
      name,
      bench,
      booking_date::text as date,
      to_char(start_time, 'HH24:MI') as "startTime",
      to_char(end_time, 'HH24:MI') as "endTime",
      purpose
    from lab_bookings
    order by booking_date asc, start_time asc, created_at asc
  `;

  return rows.map(mapBooking);
}

export async function GET() {
  try {
    await ensureBookingsTable();
    const sql = getDatabase();
    return json({ bookings: await selectBookings(sql) });
  } catch (error) {
    console.error("读取预约数据库失败：", error);
    return json({ error: "无法连接预约数据库，请检查 DATABASE_URL。" }, 500);
  }
}

export async function POST(request) {
  try {
    await ensureBookingsTable();

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "请求内容不是有效的 JSON。" }, 400);
    }

    const validation = validateBookingPayload(payload);
    if (validation.error) {
      return json({ error: validation.error }, 400);
    }

    const booking = validation.booking;
    const sql = getDatabase();

    const savedBooking = await sql.begin(async (transaction) => {
      await transaction`
        select pg_advisory_xact_lock(
          hashtext(${booking.bench}),
          hashtext(${booking.date})
        )
      `;

      const conflicts = await transaction`
        select id
        from lab_bookings
        where booking_date = ${booking.date}::date
          and bench = ${booking.bench}
          and start_time < ${booking.endTime}::time
          and end_time > ${booking.startTime}::time
          and id <> ${booking.id}
        limit 1
      `;

      if (conflicts.length > 0) {
        const conflictError = new Error("该超净台在此时间段已经被预约。");
        conflictError.code = "BOOKING_CONFLICT";
        throw conflictError;
      }

      const [row] = await transaction`
        insert into lab_bookings (
          id,
          name,
          bench,
          booking_date,
          start_time,
          end_time,
          purpose
        ) values (
          ${booking.id},
          ${booking.name},
          ${booking.bench},
          ${booking.date}::date,
          ${booking.startTime}::time,
          ${booking.endTime}::time,
          ${booking.purpose}
        )
        on conflict (id) do update set
          name = excluded.name,
          bench = excluded.bench,
          booking_date = excluded.booking_date,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          purpose = excluded.purpose
        returning
          id,
          name,
          bench,
          booking_date::text as date,
          to_char(start_time, 'HH24:MI') as "startTime",
          to_char(end_time, 'HH24:MI') as "endTime",
          purpose
      `;

      return mapBooking(row);
    });

    return json({ booking: savedBooking }, 201);
  } catch (error) {
    if (error?.code === "BOOKING_CONFLICT") {
      return json({ error: error.message }, 409);
    }

    console.error("保存预约数据库失败：", error);
    return json({ error: "预约保存失败，请检查数据库连接后重试。" }, 500);
  }
}

export async function DELETE(request) {
  try {
    await ensureBookingsTable();

    const id = normalizeText(new URL(request.url).searchParams.get("id"), 100);
    if (!id) {
      return json({ error: "缺少预约记录 ID。" }, 400);
    }

    const sql = getDatabase();
    const deletedRows = await sql`
      delete from lab_bookings
      where id = ${id}
      returning id
    `;

    if (deletedRows.length === 0) {
      return json({ error: "预约记录不存在或已被删除。" }, 404);
    }

    return json({ success: true });
  } catch (error) {
    console.error("删除预约数据库记录失败：", error);
    return json({ error: "预约删除失败，请检查数据库连接后重试。" }, 500);
  }
}
