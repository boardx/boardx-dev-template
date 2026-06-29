import { NextResponse } from "next/server";
import { canManageTeam, generateToken, expiresAt, isTeamRole, TEAM_INVITE_TTL_MS } from "@repo/auth";
import { getMembership, createTeamInvite } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const teamId = Number(params.id);
    if (!canManageTeam(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "无权限邀请" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as { role?: unknown };
    const role = typeof body.role === "string" && isTeamRole(body.role) ? body.role : "member";
    const token = generateToken();
    await createTeamInvite(token, teamId, role, expiresAt(TEAM_INVITE_TTL_MS));
    // 邀请令牌可返回（用于生成邀请链接，由邀请人分享）
    return NextResponse.json({ token, role }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
