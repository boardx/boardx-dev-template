import { NextResponse } from "next/server";
import { canManageTeam, isTeamRole } from "@repo/auth";
import { getMembership, updateMemberRole, removeMember } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 改成员角色（p21-F02 owner 保护）。双向拦截：
 *  - 目标当前是 owner 时一律拒绝（owner 自己转让所有权是另一个功能，不在本路由范围内）；
 *  - 请求把角色设为 owner 时一律拒绝——不能通过 PATCH 把任意成员提升为第二个 owner，
 *    否则会绕过上面那条保护，凭空造一个新 owner 实现团队接管（code review 抓出的回归缺口）。
 */
export async function PATCH(req: Request, { params }: { params: { id: string; userId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const teamId = Number(params.id);
    const targetId = Number(params.userId);
    if (!canManageTeam(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const body = (await req.json()) as { role?: unknown };
    const role = String(body.role ?? "");
    if (!isTeamRole(role)) return NextResponse.json({ error: "角色无效" }, { status: 400 });
    if (role === "owner") {
      return NextResponse.json({ error: "不能把角色设为 owner" }, { status: 403 });
    }
    const targetRole = await getMembership(teamId, targetId);
    if (targetRole === "owner") {
      return NextResponse.json({ error: "不能修改 owner" }, { status: 403 });
    }
    await updateMemberRole(teamId, targetId, role);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** 移除成员（p21-F02 owner 保护）。目标是 owner 时一律拒绝，无论操作者是谁。 */
export async function DELETE(_req: Request, { params }: { params: { id: string; userId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const teamId = Number(params.id);
    const targetId = Number(params.userId);
    if (!canManageTeam(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const targetRole = await getMembership(teamId, targetId);
    if (targetRole === "owner") {
      return NextResponse.json({ error: "不能移除 owner" }, { status: 403 });
    }
    await removeMember(teamId, targetId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
