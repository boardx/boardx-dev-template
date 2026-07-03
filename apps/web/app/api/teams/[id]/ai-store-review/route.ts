// apps/web/app/api/teams/[id]/ai-store-review/route.ts — P11 F06 团队审核（uc-ai-store-006）
// GET：团队管理角色（owner/admin）查看本团队待审核（PENDING）的 AI Store 项目列表。
// 非团队管理角色（含非成员）一律 403，不泄露列表内容。
import { NextResponse } from "next/server";
import { canManageTeam } from "@repo/auth";
import { getMembership, listTeamPendingAiStoreItems } from "@repo/data";
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

  const items = await listTeamPendingAiStoreItems(teamId);
  return NextResponse.json({ items });
}
