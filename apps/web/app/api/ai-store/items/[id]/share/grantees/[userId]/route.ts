// apps/web/app/api/ai-store/items/[id]/share/grantees/[userId]/route.ts — P11 F05
// DELETE：拥有者移除某个已授权用户（uc-ai-store-005 步骤 11）。owner-only——绝不信任客户端
// 传来的 item id，每次都重新从数据库取项目并比对 owner_user_id。
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import { getAiStoreItem, getMembership, removeAiStoreItemGrantee } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const itemId = Number(params.id);
  const granteeId = Number(params.userId);
  const consumerTeamId = Number(new URL(_req.url).searchParams.get("consumerTeamId"));
  if (!Number.isFinite(itemId) || !Number.isFinite(granteeId) || !Number.isFinite(consumerTeamId)) {
    return NextResponse.json({ error: "无效的 id" }, { status: 400 });
  }

  const item = await getAiStoreItem(itemId);
  const teamIdRaw = cookies().get(CURRENT_TEAM_COOKIE)?.value;
  const teamId = teamIdRaw ? Number(teamIdRaw) : null;
  if (
    teamId == null ||
    !Number.isFinite(teamId) ||
    !(await getMembership(teamId, user.id)) ||
    !item ||
    item.owner_user_id == null ||
    String(item.owner_user_id) !== String(user.id) ||
    String(item.origin_team_id) !== String(teamId)
  ) {
    return NextResponse.json({ error: "项目不存在或无权限" }, { status: 404 });
  }

  const removed = await removeAiStoreItemGrantee(itemId, granteeId, consumerTeamId);
  if (!removed) return NextResponse.json({ error: "该用户未被授权" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
