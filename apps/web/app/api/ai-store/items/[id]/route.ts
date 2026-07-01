import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import { getAiStoreItem, isAiStoreItemVisible } from "@repo/data";
import { currentUser } from "@/lib/session";

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
  if (!isAiStoreItemVisible(item, user.id, teamId)) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  return NextResponse.json({ item });
}
