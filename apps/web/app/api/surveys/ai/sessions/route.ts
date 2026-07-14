import { NextResponse } from "next/server";
import { listSurveyAiSessions } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "create_survey";
  const status = url.searchParams.get("status") ?? "open";
  const limit = Number(url.searchParams.get("limit") ?? 10);
  return NextResponse.json({ sessions: await listSurveyAiSessions(user.id, kind, status, Number.isFinite(limit) ? limit : 10) });
}
