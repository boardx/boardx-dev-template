// DELETE /api/teams/[id]/memories/[memoryId] — 删除团队 Memory（04-F13）。
import { NextResponse } from "next/server";
import { canManageTeam } from "@repo/auth";
import { deleteTeamMemory, getMembership } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string; memoryId: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const teamId = Number(params.id);
  const memoryId = Number(params.memoryId);
  if (!Number.isFinite(teamId) || !Number.isFinite(memoryId)) {
    return NextResponse.json({ error: "无效 id" }, { status: 400 });
  }
  const role = await getMembership(teamId, user.id);
  if (!canManageTeam(role)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const deleted = await deleteTeamMemory(teamId, memoryId);
  if (!deleted) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
