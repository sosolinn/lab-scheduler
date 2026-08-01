import {
  authenticateUser,
  createSession,
  createSessionCookie
} from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return Response.json(
        { error: "请求内容不是有效的 JSON。" },
        { status: 400 }
      );
    }

    const user = await authenticateUser(
      payload?.username,
      payload?.password
    );

    if (!user) {
      return Response.json(
        { error: "账户名称或密码不正确，或账户已被停用。" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const accountUser = {
      ...user,
      email: user.username,
      displayName: user.username
    };
    const token = await createSession(accountUser.id);

    return Response.json(
      {
        authenticated: true,
        user: accountUser,
        isAdmin: accountUser.role === "admin"
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": createSessionCookie(token)
        }
      }
    );
  } catch (error) {
    console.error("账户名称登录失败：", error);
    return Response.json(
      {
        error:
          error.message ||
          "登录服务暂时不可用，请检查数据库和管理员配置。"
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
