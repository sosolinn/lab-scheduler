import { randomUUID } from "node:crypto";

import { getDatabase } from "../../../../lib/database";
import {
  ensureAuthSchema,
  hashPassword,
  requireAdministrator,
  validatePassword,
  validateUsername
} from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function mapUser(row) {
  return {
    id: String(row.id),
    username: row.username,
    displayName: row.username,
    role: row.role,
    status: row.status,
    mustChangePassword: Boolean(row.mustChangePassword),
    lastLoginAt: row.lastLoginAt || "",
    createdAt: row.createdAt || ""
  };
}

async function readUsers(sql) {
  const rows = await sql`
    select
      id,
      username,
      display_name as "displayName",
      role,
      status,
      must_change_password as "mustChangePassword",
      last_login_at::text as "lastLoginAt",
      created_at::text as "createdAt"
    from lab_users
    order by
      case when role = 'admin' then 0 else 1 end,
      created_at asc,
      username asc
  `;
  return rows.map(mapUser);
}

async function requireAdmin(request) {
  await ensureAuthSchema();
  return requireAdministrator(request);
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return json({ error: auth.error }, auth.status || 401);
  }

  try {
    const sql = getDatabase();
    return json({ users: await readUsers(sql) });
  } catch (error) {
    console.error("读取实验室账户失败：", error);
    return json({ error: "无法读取账户列表，请检查数据库连接。" }, 500);
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return json({ error: auth.error }, auth.status || 401);
  }

  try {
    const payload = await request.json();
    const usernameValidation = validateUsername(payload?.username);
    const passwordValidation = validatePassword(payload?.password);
    const role = payload?.role === "admin" ? "admin" : "user";

    if (usernameValidation.error) {
      return json({ error: usernameValidation.error }, 400);
    }
    if (passwordValidation.error) {
      return json({ error: passwordValidation.error }, 400);
    }

    const accountName = usernameValidation.username;
    const passwordHash = await hashPassword(passwordValidation.password);
    const sql = getDatabase();
    const rows = await sql`
      insert into lab_users (
        id,
        username,
        display_name,
        password_hash,
        role,
        status,
        must_change_password,
        created_at,
        updated_at
      ) values (
        ${randomUUID()}::uuid,
        ${accountName},
        ${accountName},
        ${passwordHash},
        ${role},
        'active',
        true,
        now(),
        now()
      )
      returning
        id,
        username,
        display_name as "displayName",
        role,
        status,
        must_change_password as "mustChangePassword",
        last_login_at::text as "lastLoginAt",
        created_at::text as "createdAt"
    `;

    return json({ user: mapUser(rows[0]) }, 201);
  } catch (error) {
    if (error?.code === "23505") {
      return json({ error: "该成员姓名已经存在。" }, 409);
    }
    console.error("创建实验室账户失败：", error);
    return json({ error: "账户创建失败，请检查数据库连接。" }, 500);
  }
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return json({ error: auth.error }, auth.status || 401);
  }

  try {
    const payload = await request.json();
    const id = String(payload?.id || "").trim();
    const action = String(payload?.action || "").trim();

    if (!id) {
      return json({ error: "缺少账户 ID。" }, 400);
    }

    const sql = getDatabase();
    const rows = await sql`
      select id, username, role, status
      from lab_users
      where id = ${id}::uuid
      limit 1
    `;
    const target = rows[0];

    if (!target) {
      return json({ error: "账户不存在。" }, 404);
    }

    if (action === "resetPassword") {
      const validation = validatePassword(payload?.password);
      if (validation.error) {
        return json({ error: validation.error }, 400);
      }

      const passwordHash = await hashPassword(validation.password);
      await sql.begin(async (transaction) => {
        await transaction`
          update lab_users
          set
            password_hash = ${passwordHash},
            must_change_password = true,
            updated_at = now()
          where id = ${id}::uuid
        `;
        await transaction`
          delete from lab_sessions
          where user_id = ${id}::uuid
        `;
      });
    } else if (action === "setStatus") {
      const active = Boolean(payload?.active);
      if (!active && id === auth.user.id) {
        return json({ error: "不能停用当前登录的管理员账户。" }, 400);
      }

      await sql.begin(async (transaction) => {
        await transaction`
          update lab_users
          set
            status = ${active ? "active" : "disabled"},
            updated_at = now()
          where id = ${id}::uuid
        `;
        if (!active) {
          await transaction`
            delete from lab_sessions
            where user_id = ${id}::uuid
          `;
        }
      });
    } else if (action === "setRole") {
      const role = payload?.role === "admin" ? "admin" : "user";

      if (id === auth.user.id && role !== "admin") {
        return json({ error: "不能取消当前登录管理员自己的管理员权限。" }, 400);
      }

      if (target.role === "admin" && role !== "admin") {
        const adminRows = await sql`
          select count(*)::int as count
          from lab_users
          where role = 'admin'
            and status = 'active'
        `;
        if (Number(adminRows[0]?.count || 0) <= 1) {
          return json({ error: "系统至少需要保留一个启用的管理员账户。" }, 400);
        }
      }

      await sql`
        update lab_users
        set role = ${role}, updated_at = now()
        where id = ${id}::uuid
      `;
    } else if (action === "deleteUser") {
      if (id === auth.user.id) {
        return json({ error: "不能删除当前登录的管理员账户。" }, 400);
      }
      if (target.role !== "user") {
        return json({ error: "仅允许删除普通用户；管理员账户需要先调整为普通用户。" }, 400);
      }

      await sql`
        delete from lab_users
        where id = ${id}::uuid
          and role = 'user'
      `;
    } else {
      return json({ error: "不支持的账户操作。" }, 400);
    }

    return json({ users: await readUsers(sql) });
  } catch (error) {
    console.error("更新实验室账户失败：", error);
    return json({ error: "账户设置更新失败。" }, 500);
  }
}
