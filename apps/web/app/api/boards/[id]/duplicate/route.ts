import { NextResponse } from "next/server";
import { canViewRoom, duplicateBoard, getBoard, resolveBoardId } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/boards/:id/duplicate — 在同房间创建副本。需房间成员，否则 403。
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = await resolveBoardId(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canViewRoom(board.room_id, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const copy = await duplicateBoard(boardId, user.id);
    return NextResponse.json({ board: copy }, { status: 201 });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
