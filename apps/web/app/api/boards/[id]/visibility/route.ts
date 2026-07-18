import { NextResponse } from "next/server";
import { canSetBoardVisibility, getBoard, resolveBoardId, setBoardVisibility, type BoardVisibility } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: BoardVisibility[] = ["room", "team", "public"];

// PATCH /api/boards/:id/visibility { visibility } — 仅所属房间 owner 可改，否则 403。
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = await resolveBoardId(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canSetBoardVisibility(boardId, user.id))) {
      return NextResponse.json({ error: "仅房间 owner 可改可见范围" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as { visibility?: unknown };
    const visibility = body.visibility as BoardVisibility;
    if (!ALLOWED.includes(visibility)) {
      return NextResponse.json({ error: "非法可见范围" }, { status: 400 });
    }
    const updated = await setBoardVisibility(boardId, visibility);
    return NextResponse.json({ board: updated });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
