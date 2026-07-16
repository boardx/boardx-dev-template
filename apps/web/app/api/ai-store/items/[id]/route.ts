import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import {
  canAccessAiStoreItem,
  getAiStoreItem,
  getMembership,
  isAiStoreItemFavorited,
  updateAiStoreItem,
} from "@repo/data";
import { currentUser } from "@/lib/session";
import { parseAiStorePayload } from "../payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-ai-store-001：项目详情（详情弹窗数据源：描述/示例/统计）。未登录 401；不可见/不存在 404。
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "无效 id" }, { status: 400 });

  const item = await getAiStoreItem(id);
  if (!item) return NextResponse.json({ error: "未找到" }, { status: 404 });

  const teamIdCookie = cookies().get(CURRENT_TEAM_COOKIE)?.value;
  const teamId = teamIdCookie ? Number(teamIdCookie) : null;
  if (!(await canAccessAiStoreItem(item, user.id, teamId))) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  // uc-ai-store-004：详情弹窗统计区也要展示当前用户的喜欢/收藏状态。
  const liked = await isAiStoreItemFavorited(id, user.id);

  return NextResponse.json({ item: { ...item, liked } });
}

// uc-ai-store-002：属主更新自己的 AI Store 项目（编辑草稿/已发布/审核中项）。
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "无效 id" }, { status: 400 });

    const teamIdCookie = cookies().get(CURRENT_TEAM_COOKIE)?.value;
    const currentTeamId = teamIdCookie ? Number(teamIdCookie) : null;
    if (currentTeamId == null || !Number.isFinite(currentTeamId)) {
      return NextResponse.json({ error: "请先选择团队" }, { status: 400 });
    }
    if (!(await getMembership(currentTeamId, user.id))) {
      return NextResponse.json({ error: "当前团队不可用" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseAiStorePayload(body, currentTeamId);
    if (parsed.errors) return NextResponse.json({ errors: parsed.errors }, { status: 400 });

    const item = await updateAiStoreItem(id, user.id, currentTeamId, {
      ...parsed.payload!,
      ownerUserId: user.id,
      author: user.display_name || `${user.first_name} ${user.last_name}`.trim() || user.email,
    });
    if (!item) return NextResponse.json({ error: "未找到" }, { status: 404 });

    return NextResponse.json({ item });
  } catch (err) {
    console.error("[ai-store/items/:id] update failed", err);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
