import { readAuthContext } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await readAuthContext(request);

  if (auth.error) {
    return Response.json(
      { error: auth.error, authenticated: false },
      { status: auth.status || 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!auth.user) {
    return Response.json(
      { authenticated: false, user: null, isAdmin: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const accountUser = {
    ...auth.user,
    email: auth.user.username,
    displayName: auth.user.username
  };

  return Response.json(
    {
      authenticated: true,
      user: accountUser,
      isAdmin: auth.isAdmin
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
