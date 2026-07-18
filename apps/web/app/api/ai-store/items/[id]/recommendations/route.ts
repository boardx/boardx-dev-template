import { NextResponse } from "next/server";
import {
  getMembership,
  getUsableSubscribedAiStoreItem,
  listAiStoreAgentRecommendations,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const teamId = currentTeamId();
    if (teamId == null || !(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "当前团队不可用" }, { status: 403 });
    }
    const itemId = Number(params.id);
    if (!Number.isFinite(itemId)) return NextResponse.json({ error: "无效 id" }, { status: 400 });
    const usable = await getUsableSubscribedAiStoreItem({ itemId, userId: user.id, consumerTeamId: teamId });
    if (!usable.item) {
      return NextResponse.json({ error: "资源不可使用" }, { status: usable.reason === "unavailable" ? 410 : 403 });
    }
    if (usable.item.type !== "skill") return NextResponse.json({ error: "仅 Skill 支持推荐" }, { status: 400 });
    const items = await listAiStoreAgentRecommendations(itemId, user.id, teamId);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[ai-store/items/:id/recommendations] failed", err);
    return NextResponse.json({ items: [] });
  }
}
