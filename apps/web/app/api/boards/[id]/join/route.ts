import { NextResponse } from "next/server";
import { addRoomMember, getBoard, getBoardAccessRole, resolveBoardId } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/boards/:id/join — 已登录用户按可见策略加入协作（成为房间成员=editor）。
// 需登录；白板对该用户可访问（public / team / 已是成员）才能加入，否则 403。
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = await resolveBoardId(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    const role = await getBoardAccessRole(boardId, user.id);
    if (!role) return NextResponse.json({ error: "无权限加入" }, { status: 403 });
    await addRoomMember(board.room_id, user.id);
    return NextResponse.json({ ok: true, role: "editor" });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
