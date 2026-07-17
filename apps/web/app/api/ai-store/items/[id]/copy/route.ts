import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import {
  canAccessAiStoreItem,
  copyAiStoreItem,
  getAiStoreItem,
  getMembership,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "无效 id" }, { status: 400 });
    const currentTeamId = Number(cookies().get(CURRENT_TEAM_COOKIE)?.value);
    if (!Number.isFinite(currentTeamId)) {
      return NextResponse.json({ error: "请先选择团队" }, { status: 400 });
    }
    if (!(await getMembership(currentTeamId, user.id))) {
      return NextResponse.json({ error: "当前团队不可用" }, { status: 403 });
    }

    const source = await getAiStoreItem(id);
    if (!source || !(await canAccessAiStoreItem(source, user.id, currentTeamId))) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (!source.allow_copy) {
      return NextResponse.json({ error: "该资源不允许复制" }, { status: 403 });
    }

    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (idempotencyKey && idempotencyKey.length > 200) {
      return NextResponse.json({ error: "幂等键过长" }, { status: 400 });
    }
    const author = user.display_name || `${user.first_name} ${user.last_name}`.trim() || user.email;
    const result = await copyAiStoreItem(source, user.id, currentTeamId, author, idempotencyKey);
    return NextResponse.json(
      { item: result.item, board: result.board },
      { status: result.idempotent ? 200 : 201 },
    );
  } catch (err) {
    console.error("[ai-store/items/:id/copy] copy failed", err);
    return NextResponse.json({ error: "复制失败" }, { status: 500 });
  }
}
