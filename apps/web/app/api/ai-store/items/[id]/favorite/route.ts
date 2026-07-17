import { NextResponse } from "next/server";
import {
  canAccessAiStoreItem,
  getAiStoreItem,
  getMembership,
  toggleAiStoreFavorite,
} from "@repo/data";
import { currentUser } from "@/lib/session";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-ai-store-004：切换某 AI Store 项目的喜欢/收藏状态。
// POST /api/ai-store/items/:id/favorite — 未登录 401；项目不存在/不可见 404；
// 成功返回切换后的 { favorited, likes }，供前端做乐观更新的最终校验/回滚。
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "无效 id" }, { status: 400 });

  const item = await getAiStoreItem(id);
  if (!item) return NextResponse.json({ error: "未找到" }, { status: 404 });

  const teamIdCookie = cookies().get(CURRENT_TEAM_COOKIE)?.value;
  const teamId = teamIdCookie ? Number(teamIdCookie) : null;
  if (teamId == null || !Number.isFinite(teamId)) {
    return NextResponse.json({ error: "请先选择团队" }, { status: 400 });
  }
  if (!(await getMembership(teamId, user.id))) {
    return NextResponse.json({ error: "当前团队不可用" }, { status: 403 });
  }
  if (!(await canAccessAiStoreItem(item, user.id, teamId))) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  const result = await toggleAiStoreFavorite(id, user.id, teamId);
  if (!result) return NextResponse.json({ error: "未找到" }, { status: 404 });

  return NextResponse.json(result);
}
