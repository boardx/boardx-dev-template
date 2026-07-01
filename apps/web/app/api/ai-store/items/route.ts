import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import { listAiStoreItems, type AiStoreItemType } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: AiStoreItemType[] = ["agent", "ai-tool", "image-tool", "template"];

// uc-ai-store-001：浏览 AI Store 项目（Agent/AI 工具/图片工具/模板）。
// GET /api/ai-store/items?type=&q=&tag=&page=&pageSize= — 分页列表；未登录 401（页面层由 /ai-store 做 302 登录跳转）。
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
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

  return NextResponse.json(result);
}
