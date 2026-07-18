import { NextResponse } from "next/server";
import { getValidInvite, consumeInvite, addMember } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = (await req.json()) as { token?: unknown };
    const token = String(body.token ?? "");
    const invite = await getValidInvite(token);
    if (!invite) return NextResponse.json({ error: "邀请无效或已过期" }, { status: 400 });
    await addMember(invite.team_id, user.id, invite.role);
    await consumeInvite(token);
    return NextResponse.json({ ok: true, teamId: invite.team_id, role: invite.role });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
