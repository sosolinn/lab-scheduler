import postgres from "postgres";

let databaseClient;

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("缺少 DATABASE_URL，请在 .env.local 或部署平台中配置 Supabase 数据库连接地址。");
  }

  if (!databaseClient) {
    databaseClient = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 20,
      prepare: false,
      ssl: "require"
    });
  }

  return databaseClient;
}

function isRetryableDatabaseError(error) {
  const code = String(error?.code || error?.errno || "").toUpperCase();

  return [
    "CONNECT_TIMEOUT",
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED"
  ].includes(code);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function withDatabaseReadRetry(
  operation,
  { retries = 1, delayMs = 800 } = {}
) {
  if (typeof operation !== "function") {
    throw new TypeError("数据库读取重试操作必须是函数。");
  }

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const shouldRetry = attempt < retries && isRetryableDatabaseError(error);
      if (!shouldRetry) {
        throw error;
      }

      console.warn(
        `数据库读取连接失败，${delayMs}ms 后进行第 ${attempt + 2} 次尝试。`
      );
      await wait(delayMs);
    }
  }

  throw lastError;
}
