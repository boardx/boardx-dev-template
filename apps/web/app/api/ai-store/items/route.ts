import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import {
  createAiStoreItem,
  getAiStoreItem,
  getMembership,
  listAiStoreItems,
  listAuthorizedAiStoreItems,
  listFavoritedAiStoreItemIds,
  listOwnedAiStoreItems,
  listSubscribedAiStoreItemIds,
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
  const teamIdCookie = cookies().get(CURRENT_TEAM_COOKIE)?.value;
  const teamId = teamIdCookie ? Number(teamIdCookie) : null;
  if (teamId == null || !Number.isFinite(teamId)) {
    return NextResponse.json({ error: "请先选择团队" }, { status: 400 });
  }
  if (!(await getMembership(teamId, user.id))) {
    return NextResponse.json({ error: "当前团队不可用" }, { status: 403 });
  }

  if (url.searchParams.get("owner") === "me") {
    return NextResponse.json({ items: await listOwnedAiStoreItems(user.id, teamId) });
  }
  // uc-ai-store-005：Authorized 视图——自己被授权管理、但非本人拥有的项目（授权视图只显示
  // 被授权范围内项目，不含拥有者自己的项目，避免和 owner=me 的 Create 视图重复）。
  if (url.searchParams.get("authorized") === "me") {
    return NextResponse.json({ items: await listAuthorizedAiStoreItems(user.id) });
  }

  if (url.searchParams.get("subscribed") === "me") {
    const ids = await listSubscribedAiStoreItemIds({
      subscriberUserId: user.id,
      consumerTeamId: teamId,
    });
    const items = (await Promise.all(ids.map((id) => getAiStoreItem(id)))).filter(
      (it): it is NonNullable<typeof it> => Boolean(it)
    );
    return NextResponse.json({ items });
  }

  const typeParam = url.searchParams.get("type") ?? "";
  const type = (VALID_TYPES as string[]).includes(typeParam) ? (typeParam as AiStoreItemType) : "";
  const q = url.searchParams.get("q") ?? "";
  const tag = url.searchParams.get("tag") ?? "";
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(url.searchParams.get("pageSize") ?? "9") || 9;

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
  // 注意：listAiStoreItems 的 id 是 bigint，pg 运行时按字符串返回（与类型注解不符），
  // 这里显式 Number() 归一化后再与 Set<number> 比对，避免 string/number 失配。
  const likedIds = await listFavoritedAiStoreItemIds(
    result.items.map((it) => Number(it.id)),
    user.id,
  );
  const items = result.items.map((it) => ({ ...it, liked: likedIds.has(Number(it.id)) }));

  return NextResponse.json({ ...result, items });
}

// uc-ai-store-002：创建 AI Store 项目。支持草稿、发布到个人/团队、提交平台审核。
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

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

    const item = await createAiStoreItem({
      ...parsed.payload!,
      ownerUserId: user.id,
      author: user.display_name || `${user.first_name} ${user.last_name}`.trim() || user.email,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error("[ai-store/items] create failed", err);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
