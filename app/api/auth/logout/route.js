import {
  clearSessionCookie,
  deleteSession
} from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    await deleteSession(request);
  } catch (error) {
    console.warn("删除登录会话失败：", error);
  }

  return Response.json(
    { success: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": clearSessionCookie()
      }
    }
  );
}
