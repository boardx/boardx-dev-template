import { NextResponse } from "next/server";
import { getTeam, isTeamType, updateTeamType } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-002 — 后台团队编辑 API（F03，真实 DB，CAP-DATA）。
// PATCH /api/admin/teams/:id { teamType } —— 目前后台支持范围内只允许更新团队类型
// （standard | enterprise）；改名/删除等属团队自身设置（uc-team-007），不在本 feature 范围。
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const teamId = Number(params.id);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return NextResponse.json({ error: "无效的团队 ID" }, { status: 400 });
  }
  const team = await getTeam(teamId);
  if (!team) return NextResponse.json({ error: "团队不存在" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { teamType?: unknown };
  const teamType = String(body.teamType ?? "");
  if (!isTeamType(teamType)) {
    return NextResponse.json({ errors: { teamType: "团队类型必须是 standard 或 enterprise" } }, { status: 400 });
  }

  await updateTeamType(teamId, teamType);
  const updated = await getTeam(teamId);
  return NextResponse.json({ team: updated });
}
