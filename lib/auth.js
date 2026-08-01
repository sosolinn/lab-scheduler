import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

import { getDatabase } from "./database";

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE_NAME = "lab_scheduler_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const PASSWORD_MIN_LENGTH = 8;
const USERNAME_PATTERN = /^[\p{L}\p{N}._-]{2,32}$/u;
const SCRYPT_PARAMETERS = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 64
};

let schemaPromise;

function normalizeText(value, maximumLength = 120) {
  return String(value || "").trim().slice(0, maximumLength);
}

export function normalizeUsername(value) {
  return normalizeText(value, 32).toLocaleLowerCase("en-US");
}

export function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username)) {
    return {
      error: "用户名需为 2–32 位中文、字母、数字、点、下划线或短横线。"
    };
  }
  return { username };
}

export function validatePassword(value) {
  const password = String(value || "");
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { error: `密码至少需要 ${PASSWORD_MIN_LENGTH} 位。` };
  }
  if (password.length > 128) {
    return { error: "密码不能超过 128 位。" };
  }
  return { password };
}

export function normalizeDisplayName(value, fallback = "") {
  return normalizeText(value, 30).replace(/\s+/g, " ") || fallback;
}

export async function hashPassword(password) {
  const validation = validatePassword(password);
  if (validation.error) {
    throw new Error(validation.error);
  }

  const salt = randomBytes(16);
  const derivedKey = await scrypt(validation.password, salt, SCRYPT_PARAMETERS.keyLength, {
    N: SCRYPT_PARAMETERS.cost,
    r: SCRYPT_PARAMETERS.blockSize,
    p: SCRYPT_PARAMETERS.parallelization,
    maxmem: 64 * 1024 * 1024
  });

  return [
    "scrypt",
    SCRYPT_PARAMETERS.cost,
    SCRYPT_PARAMETERS.blockSize,
    SCRYPT_PARAMETERS.parallelization,
    salt.toString("base64"),
    Buffer.from(derivedKey).toString("base64")
  ].join("$");
}

export async function verifyPassword(password, encodedHash) {
  try {
    const [algorithm, cost, blockSize, parallelization, saltValue, hashValue] =
      String(encodedHash || "").split("$");

    if (algorithm !== "scrypt" || !saltValue || !hashValue) {
      return false;
    }

    const expected = Buffer.from(hashValue, "base64");
    const actual = await scrypt(String(password || ""), Buffer.from(saltValue, "base64"), expected.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
      maxmem: 64 * 1024 * 1024
    });
    const actualBuffer = Buffer.from(actual);

    return (
      actualBuffer.length === expected.length &&
      timingSafeEqual(actualBuffer, expected)
    );
  } catch {
    return false;
  }
}

function hashSessionToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function parseCookies(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=");
        if (separator < 0) return [item, ""];
        return [
          item.slice(0, separator),
          decodeURIComponent(item.slice(separator + 1))
        ];
      })
  );
}

export function getSessionToken(request) {
  return parseCookies(request)[SESSION_COOKIE_NAME] || "";
}

export function createSessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    secure.replace(/^;\s*/, "")
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure.replace(/^;\s*/, "")
  ]
    .filter(Boolean)
    .join("; ");
}

function publicUser(row) {
  const username = String(row.username || "");
  return {
    id: String(row.id),
    username,
    email: username,
    displayName: row.displayName || username,
    role: row.role === "admin" ? "admin" : "user",
    mustChangePassword: Boolean(row.mustChangePassword),
    status: row.status || "active"
  };
}

async function bootstrapAdministrator(sql) {
  const adminRows = await sql`
    select id
    from lab_users
    where role = 'admin'
    limit 1
  `;
  if (adminRows.length > 0) {
    return;
  }

  const usernameValidation = validateUsername(
    process.env.LAB_BOOTSTRAP_ADMIN_USERNAME
  );
  const passwordValidation = validatePassword(
    process.env.LAB_BOOTSTRAP_ADMIN_PASSWORD
  );

  if (usernameValidation.error || passwordValidation.error) {
    console.warn(
      "尚未创建本地管理员。请配置 LAB_BOOTSTRAP_ADMIN_USERNAME 和至少 8 位的 LAB_BOOTSTRAP_ADMIN_PASSWORD。"
    );
    return;
  }

  const passwordHash = await hashPassword(passwordValidation.password);
  const displayName = normalizeDisplayName(
    process.env.LAB_BOOTSTRAP_ADMIN_DISPLAY_NAME,
    usernameValidation.username
  );

  await sql`
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
      ${usernameValidation.username},
      ${displayName},
      ${passwordHash},
      'admin',
      'active',
      false,
      now(),
      now()
    )
    on conflict (username) do nothing
  `;
}

export async function ensureAuthSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getDatabase();

      await sql`
        create table if not exists lab_users (
          id uuid primary key,
          username text not null unique,
          display_name text not null,
          password_hash text not null,
          role text not null default 'user'
            check (role in ('admin', 'user')),
          status text not null default 'active'
            check (status in ('active', 'disabled')),
          must_change_password boolean not null default true,
          last_login_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;

      await sql`
        create table if not exists lab_sessions (
          token_hash text primary key,
          user_id uuid not null references lab_users(id) on delete cascade,
          expires_at timestamptz not null,
          created_at timestamptz not null default now(),
          last_seen_at timestamptz not null default now()
        )
      `;

      await sql`
        create index if not exists lab_sessions_user_idx
        on lab_sessions (user_id)
      `;
      await sql`
        create index if not exists lab_sessions_expiry_idx
        on lab_sessions (expires_at)
      `;

      await sql`alter table lab_users enable row level security`;
      await sql`alter table lab_sessions enable row level security`;
      await sql`revoke all on table lab_users from anon, authenticated`;
      await sql`revoke all on table lab_sessions from anon, authenticated`;

      await sql`
        delete from lab_sessions
        where expires_at <= now()
      `;

      await bootstrapAdministrator(sql);
    })();
  }

  try {
    await schemaPromise;
  } catch (error) {
    schemaPromise = undefined;
    throw error;
  }
}

export async function authenticateUser(usernameValue, password) {
  await ensureAuthSchema();
  const usernameValidation = validateUsername(usernameValue);
  if (usernameValidation.error) {
    return null;
  }

  const sql = getDatabase();
  const rows = await sql`
    select
      id,
      username,
      display_name as "displayName",
      password_hash as "passwordHash",
      role,
      status,
      must_change_password as "mustChangePassword"
    from lab_users
    where username = ${usernameValidation.username}
    limit 1
  `;
  const row = rows[0];

  if (
    !row ||
    row.status !== "active" ||
    !(await verifyPassword(password, row.passwordHash))
  ) {
    return null;
  }

  await sql`
    update lab_users
    set last_login_at = now(), updated_at = now()
    where id = ${row.id}::uuid
  `;

  return publicUser(row);
}

export async function createSession(userId) {
  await ensureAuthSchema();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const sql = getDatabase();

  await sql`
    insert into lab_sessions (
      token_hash,
      user_id,
      expires_at,
      created_at,
      last_seen_at
    ) values (
      ${tokenHash},
      ${userId}::uuid,
      now() + interval '7 days',
      now(),
      now()
    )
  `;

  return token;
}

export async function deleteSession(request) {
  const token = getSessionToken(request);
  if (!token) return;

  await ensureAuthSchema();
  const sql = getDatabase();
  await sql`
    delete from lab_sessions
    where token_hash = ${hashSessionToken(token)}
  `;
}

export async function readAuthContext(request, { required = false } = {}) {
  try {
    await ensureAuthSchema();
    const token = getSessionToken(request);

    if (!token) {
      if (required) {
        return { error: "请先登录后再进行操作。", status: 401 };
      }
      return { user: null, isAdmin: false, token: "" };
    }

    const tokenHash = hashSessionToken(token);
    const sql = getDatabase();
    const rows = await sql`
      select
        users.id,
        users.username,
        users.display_name as "displayName",
        users.role,
        users.status,
        users.must_change_password as "mustChangePassword"
      from lab_sessions as sessions
      join lab_users as users on users.id = sessions.user_id
      where sessions.token_hash = ${tokenHash}
        and sessions.expires_at > now()
        and users.status = 'active'
      limit 1
    `;
    const row = rows[0];

    if (!row) {
      await sql`
        delete from lab_sessions
        where token_hash = ${tokenHash}
      `;
      if (required) {
        return { error: "登录状态已失效，请重新登录。", status: 401 };
      }
      return { user: null, isAdmin: false, token: "" };
    }

    await sql`
      update lab_sessions
      set last_seen_at = now()
      where token_hash = ${tokenHash}
    `;

    const user = publicUser(row);
    return {
      user,
      isAdmin: user.role === "admin",
      token,
      tokenHash
    };
  } catch (error) {
    console.error("读取本地登录状态失败：", error);
    return {
      error: "暂时无法验证登录状态，请检查数据库连接。",
      status: 503
    };
  }
}

export async function requireAdministrator(request) {
  const auth = await readAuthContext(request, { required: true });
  if (auth.error) return auth;
  if (!auth.isAdmin) {
    return { error: "仅管理员可以执行此操作。", status: 403 };
  }
  return auth;
}

export async function updateOwnProfile(userId, displayNameValue) {
  await ensureAuthSchema();
  const displayName = normalizeDisplayName(displayNameValue);
  if (!displayName) {
    throw new Error("显示姓名不能为空。");
  }

  const sql = getDatabase();
  const rows = await sql`
    update lab_users
    set display_name = ${displayName}, updated_at = now()
    where id = ${userId}::uuid
    returning
      id,
      username,
      display_name as "displayName",
      role,
      status,
      must_change_password as "mustChangePassword"
  `;

  if (!rows[0]) {
    throw new Error("账户不存在或已停用。");
  }
  return publicUser(rows[0]);
}

export async function changeOwnPassword(
  userId,
  currentPassword,
  newPassword,
  currentTokenHash
) {
  await ensureAuthSchema();
  const passwordValidation = validatePassword(newPassword);
  if (passwordValidation.error) {
    throw new Error(passwordValidation.error);
  }

  const sql = getDatabase();
  const rows = await sql`
    select password_hash as "passwordHash"
    from lab_users
    where id = ${userId}::uuid
      and status = 'active'
    limit 1
  `;

  if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].passwordHash))) {
    throw new Error("当前密码不正确。");
  }

  const passwordHash = await hashPassword(passwordValidation.password);

  await sql.begin(async (transaction) => {
    await transaction`
      update lab_users
      set
        password_hash = ${passwordHash},
        must_change_password = false,
        updated_at = now()
      where id = ${userId}::uuid
    `;

    if (currentTokenHash) {
      await transaction`
        delete from lab_sessions
        where user_id = ${userId}::uuid
          and token_hash <> ${currentTokenHash}
      `;
    } else {
      await transaction`
        delete from lab_sessions
        where user_id = ${userId}::uuid
      `;
    }
  });
}
