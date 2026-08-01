import {
  getDatabase,
  withDatabaseReadRetry
} from "../../../lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["booking", "duty"]);
let schemaPromise;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function normalizeName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, 30);
}

function normalizeType(value) {
  return ALLOWED_TYPES.has(value) ? value : "";
}

function comparisonKey(value) {
  return normalizeName(value).toLocaleLowerCase("zh-CN");
}

async function ensurePeopleTable() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getDatabase();

      await sql`
        create table if not exists lab_people (
          id bigserial primary key,
          person_type text not null check (person_type in ('booking', 'duty')),
          name text not null,
          normalized_name text not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (person_type, normalized_name)
        )
      `;

      await sql`
        create index if not exists lab_people_type_name_idx
        on lab_people (person_type, normalized_name)
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

export async function GET(request) {
  try {
    return await withDatabaseReadRetry(async () => {
      await ensurePeopleTable();

      const type = normalizeType(new URL(request.url).searchParams.get("type"));
      if (!type) {
        return json({ error: "人员类型不正确。" }, 400);
      }

      const sql = getDatabase();
      const rows = await sql`
        select name
        from lab_people
        where person_type = ${type}
        order by created_at asc, id asc
      `;

      return json({ people: rows.map((row) => row.name) });
    });
  } catch (error) {
    console.error("读取人员数据库失败：", error);
    return json(
      {
        error:
          error?.code === "CONNECT_TIMEOUT"
            ? "数据库连接超时，请稍后刷新重试。"
            : "无法读取人员名单，请检查数据库连接。"
      },
      500
    );
  }
}

export async function POST(request) {
  try {
    await ensurePeopleTable();

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "请求内容不是有效的 JSON。" }, 400);
    }

    const type = normalizeType(payload?.type);
    const name = normalizeName(payload?.name);

    if (!type) {
      return json({ error: "人员类型不正确。" }, 400);
    }
    if (!name) {
      return json({ error: "请输入人员姓名。" }, 400);
    }

    const sql = getDatabase();
    const [row] = await sql`
      insert into lab_people (
        person_type,
        name,
        normalized_name
      ) values (
        ${type},
        ${name},
        ${comparisonKey(name)}
      )
      on conflict (person_type, normalized_name) do update set
        name = excluded.name,
        updated_at = now()
      returning name
    `;

    return json({ person: row.name }, 201);
  } catch (error) {
    console.error("保存人员数据库失败：", error);
    return json({ error: "人员保存失败，请检查数据库连接。" }, 500);
  }
}

export async function DELETE(request) {
  try {
    await ensurePeopleTable();

    const url = new URL(request.url);
    const type = normalizeType(url.searchParams.get("type"));
    const name = normalizeName(url.searchParams.get("name"));

    if (!type || !name) {
      return json({ error: "缺少需要删除的人员信息。" }, 400);
    }

    const sql = getDatabase();
    await sql`
      delete from lab_people
      where person_type = ${type}
        and normalized_name = ${comparisonKey(name)}
    `;

    return json({ success: true });
  } catch (error) {
    console.error("删除人员数据库记录失败：", error);
    return json({ error: "人员删除失败，请检查数据库连接。" }, 500);
  }
}
