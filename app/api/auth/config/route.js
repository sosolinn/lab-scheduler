import { getSupabaseAuthConfig } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getSupabaseAuthConfig();
    return Response.json(config, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Supabase Auth 尚未配置。" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
