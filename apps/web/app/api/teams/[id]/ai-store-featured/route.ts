// apps/web/app/api/teams/[id]/ai-store-featured/route.ts — P11 F06 团队精选（uc-ai-store-006）
// GET：团队管理角色查看本团队已批准（published）的 AI Store 项目，供精选切换列表使用。
import { NextResponse } from "next/server";
import { canManageTeam } from "@repo/auth";
import { getMembership, listTeamApprovedAiStoreItems } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const teamId = Number(params.id);
  if (!Number.isFinite(teamId)) return NextResponse.json({ error: "无效的团队 id" }, { status: 400 });

  if (!canManageTeam(await getMembership(teamId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const items = await listTeamApprovedAiStoreItems(teamId);
  return NextResponse.json({ items });
}
