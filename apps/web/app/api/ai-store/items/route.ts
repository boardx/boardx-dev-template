import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import {
  createAiStoreItem,
  getMembership,
  listAiStoreItems,
  listFavoritedAiStoreItemIds,
  listOwnedAiStoreItems,
  type AiStoreItemType,
} from "@repo/data";
import { currentUser } from "@/lib/session";
import { parseAiStorePayload, VALID_TYPES } from "./payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-ai-store-001：浏览 AI Store 项目（Agent/AI 工具/图片工具/模板）。
// GET /api/ai-store/items?type=&q=&tag=&page=&pageSize= — 分页列表；未登录 401（页面层由 /ai-store 做 302 登录跳转）。
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  if (url.searchParams.get("owner") === "me") {
    return NextResponse.json({ items: await listOwnedAiStoreItems(user.id) });
  }

  const typeParam = url.searchParams.get("type") ?? "";
  const type = (VALID_TYPES as string[]).includes(typeParam) ? (typeParam as AiStoreItemType) : "";
  const q = url.searchParams.get("q") ?? "";
  const tag = url.searchParams.get("tag") ?? "";
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(url.searchParams.get("pageSize") ?? "9") || 9;

  const teamIdCookie = cookies().get(CURRENT_TEAM_COOKIE)?.value;
  const teamId = teamIdCookie ? Number(teamIdCookie) : null;

  const result = await listAiStoreItems({
    type,
    q,
    tag,
    userId: user.id,
    teamId,
    page,
    pageSize,
  });

  // uc-ai-store-004：批量标注当前用户对本页项目的喜欢/收藏状态（心形高亮）。
  const likedIds = await listFavoritedAiStoreItemIds(result.items.map((it) => it.id), user.id);
  const items = result.items.map((it) => ({ ...it, liked: likedIds.has(it.id) }));

  return NextResponse.json({ ...result, items });
}

// uc-ai-store-002：创建 AI Store 项目。支持草稿、发布到个人/团队、提交平台审核。
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const teamIdCookie = cookies().get(CURRENT_TEAM_COOKIE)?.value;
    const currentTeamId = teamIdCookie ? Number(teamIdCookie) : null;
    if (currentTeamId != null && !(await getMembership(currentTeamId, user.id))) {
      return NextResponse.json({ error: "当前团队不可用" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseAiStorePayload(body, currentTeamId);
    if (parsed.errors) return NextResponse.json({ errors: parsed.errors }, { status: 400 });

    const item = await createAiStoreItem({
      ...parsed.payload!,
      ownerUserId: user.id,
      author: user.display_name || `${user.first_name} ${user.last_name}`.trim() || user.email,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
