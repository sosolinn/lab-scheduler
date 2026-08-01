import {
  changeOwnPassword,
  readAuthContext
} from "../../../../lib/auth";

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

  try {
    const payload = await request.json();
    await changeOwnPassword(
      auth.user.id,
      payload?.currentPassword,
      payload?.newPassword,
      auth.tokenHash
    );

    return Response.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "密码更新失败。" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
