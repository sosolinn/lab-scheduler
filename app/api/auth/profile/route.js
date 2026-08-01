import { readAuthContext } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request) {
  const auth = await readAuthContext(request, { required: true });
  if (auth.error) {
    return Response.json(
      { error: auth.error },
      { status: auth.status || 401 }
    );
  }

  return Response.json(
    {
      error: "账户名称同时作为登录名和显示姓名，由管理员创建后不能自行修改。"
    },
    {
      status: 405,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
