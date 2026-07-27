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
      connect_timeout: 10,
      prepare: false,
      ssl: "require"
    });
  }

  return databaseClient;
}
