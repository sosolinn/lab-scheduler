export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BEIJING_TIME_ZONE = "Asia/Shanghai";

function getBeijingParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export async function GET() {
  const now = new Date();
  const parts = getBeijingParts(now);

  return Response.json(
    {
      epochMs: now.getTime(),
      iso: now.toISOString(),
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}:${parts.second}`,
      timeZone: BEIJING_TIME_ZONE
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache"
      }
    }
  );
}
