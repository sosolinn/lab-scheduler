export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      mode: "local-username",
      registrationEnabled: false,
      passwordMinimumLength: 8
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
