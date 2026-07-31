const DEFAULT_AUTH_ERROR = "用户身份验证失败，请重新登录。";

function normalizeEmail(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}

export function getSupabaseAuthConfig() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const publishableKey = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ""
  ).trim();

  if (!url || !publishableKey) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。"
    );
  }

  return { url, publishableKey };
}

function getBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getAdminEmails() {
  return new Set(
    String(process.env.LAB_ADMIN_EMAILS || "")
      .split(/[;,\n]+/)
      .map(normalizeEmail)
      .filter(Boolean)
  );
}

export async function readAuthContext(request, { required = false } = {}) {
  const token = getBearerToken(request);

  if (!token) {
    if (required) {
      return { error: "请先登录后再进行预约操作。", status: 401 };
    }
    return { user: null, isAdmin: false, token: "" };
  }

  let config;
  try {
    config = getSupabaseAuthConfig();
  } catch (error) {
    return { error: error.message, status: 500 };
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: "GET",
      cache: "no-store",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return { error: DEFAULT_AUTH_ERROR, status: 401 };
    }

    const user = await response.json();
    const email = normalizeEmail(user?.email);

    if (!user?.id || !email) {
      return { error: DEFAULT_AUTH_ERROR, status: 401 };
    }

    return {
      user: {
        id: String(user.id),
        email,
        displayName:
          String(user?.user_metadata?.display_name || "").trim() ||
          email.split("@")[0]
      },
      isAdmin: getAdminEmails().has(email),
      token
    };
  } catch (error) {
    console.error("验证 Supabase 用户失败：", error);
    return { error: "暂时无法验证登录状态，请稍后重试。", status: 503 };
  }
}
