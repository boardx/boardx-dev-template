import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getMembership,
  getUsableSubscribedAiStoreItem,
  instantiateAiStoreTemplate,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
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
      return NextResponse.json(
        { error: usable.reason === "unavailable" ? "资源已不可用" : "请先在当前团队订阅该资源" },
        { status: usable.reason === "unavailable" ? 410 : 403 },
      );
    }
    if (usable.item.type !== "template") {
      return NextResponse.json({ item: usable.item, teamId });
    }
    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim() || randomUUID();
    if (idempotencyKey.length > 200) return NextResponse.json({ error: "幂等键过长" }, { status: 400 });
    const result = await instantiateAiStoreTemplate({
      source: usable.item,
      userId: user.id,
      consumerTeamId: teamId,
      idempotencyKey,
    });
    return NextResponse.json(
      { item: usable.item, board: result.board },
      { status: result.idempotent ? 200 : 201 },
    );
  } catch (err) {
    console.error("[ai-store/items/:id/use] failed", err);
    return NextResponse.json({ error: "无法使用该资源" }, { status: 500 });
  }
}
