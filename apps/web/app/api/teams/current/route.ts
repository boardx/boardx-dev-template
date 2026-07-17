import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import { getMembership } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const teamId = cookies().get(CURRENT_TEAM_COOKIE)?.value ?? null;
  return NextResponse.json({ teamId: teamId ? Number(teamId) : null });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = (await req.json()) as { teamId?: unknown };
    const teamId = Number(body.teamId);
    if (!Number.isFinite(teamId)) return NextResponse.json({ error: "teamId 无效" }, { status: 400 });
    // 只能切换到自己已加入的团队
    if (!(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "你不是该团队成员" }, { status: 403 });
    }
    cookies().set(CURRENT_TEAM_COOKIE, String(teamId), { httpOnly: true, sameSite: "lax", path: "/" });
    return NextResponse.json({ teamId });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
