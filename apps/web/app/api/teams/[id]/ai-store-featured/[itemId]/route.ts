// apps/web/app/api/teams/[id]/ai-store-featured/[itemId]/route.ts — P11 F06 团队精选切换
// POST body { featured: boolean }：团队管理角色（owner/admin）切换某已批准（published）
// team-scope 项目的团队精选状态。复用 setTeamAiStoreItemFeatured 的 team_id 绑定校验——
// 不存在/不属于该团队/当前状态非 published 时统一 404，不区分具体原因，避免探测团队内部数据。
import { NextResponse } from "next/server";
import { canManageTeam } from "@repo/auth";
import { getMembership, setTeamAiStoreItemFeatured } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string; itemId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const teamId = Number(params.id);
    const itemId = Number(params.itemId);
    if (!Number.isFinite(teamId) || !Number.isFinite(itemId)) {
      return NextResponse.json({ error: "无效的 id" }, { status: 400 });
    }

    if (!canManageTeam(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { featured?: unknown };
    if (typeof body.featured !== "boolean") {
      return NextResponse.json({ error: "featured 必须是布尔值" }, { status: 400 });
    }

    const item = await setTeamAiStoreItemFeatured(itemId, teamId, body.featured);
    if (!item) return NextResponse.json({ error: "项目不存在或当前状态不支持精选" }, { status: 404 });

    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
