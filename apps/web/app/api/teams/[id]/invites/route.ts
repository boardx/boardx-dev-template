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
    // p21-F02：不允许签发 role=owner 的邀请，避免绕过成员路由的 owner 保护另造一个 owner 实现团队接管。
    const requestedRole = typeof body.role === "string" && isTeamRole(body.role) ? body.role : "member";
    const role = requestedRole === "owner" ? "member" : requestedRole;
    const token = generateToken();
    await createTeamInvite(token, teamId, role, expiresAt(TEAM_INVITE_TTL_MS));
    // 邀请令牌可返回（用于生成邀请链接，由邀请人分享）
    return NextResponse.json({ token, role }, { status: 201 });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
