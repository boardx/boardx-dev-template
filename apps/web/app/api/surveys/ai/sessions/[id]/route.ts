import { NextResponse } from "next/server";
import { getSurveyAiSessionBundle, updateSurveyAiSessionForUser } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const bundle = await getSurveyAiSessionBundle(params.id, user.id);
  return bundle ? NextResponse.json(bundle) : NextResponse.json({ error: "会话不存在" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { status?: unknown };
  const status = ["open", "applied", "discarded"].includes(String(body.status)) ? String(body.status) : "open";
  const updated = await updateSurveyAiSessionForUser(params.id, user.id, status);
  return updated ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "会话不存在" }, { status: 404 });
}
