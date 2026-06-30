import { NextResponse } from "next/server";
import { getBoard, getRoom, canManageBoard, canViewRoom, moveBoard } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/boards/:id/move { targetRoomId } — 移动白板。
// 需源白板管理权限 + 目标房间成员权限，否则 403。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = Number(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canManageBoard(boardId, user.id))) {
      return NextResponse.json({ error: "无源白板管理权限" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as { targetRoomId?: unknown };
    const targetRoomId = Number(body.targetRoomId);
    if (!targetRoomId) return NextResponse.json({ error: "缺少 targetRoomId" }, { status: 400 });
    const target = await getRoom(targetRoomId);
    if (!target) return NextResponse.json({ error: "目标房间不存在" }, { status: 404 });
    if (!(await canViewRoom(targetRoomId, user.id))) {
      return NextResponse.json({ error: "无目标房间权限" }, { status: 403 });
    }
    const moved = await moveBoard(boardId, targetRoomId, target.team_id);
    return NextResponse.json({ board: moved });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
