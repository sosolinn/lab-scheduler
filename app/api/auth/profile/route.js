import {
  readAuthContext,
  updateOwnProfile
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
    const user = await updateOwnProfile(
      auth.user.id,
      payload?.displayName
    );

    return Response.json(
      { user },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "账户资料更新失败。" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
