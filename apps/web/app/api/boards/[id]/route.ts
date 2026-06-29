import { NextResponse } from "next/server";
import { getBoard, canViewRoom, boardRole } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/boards/:id — 返回白板元数据 + 当前用户角色（owner/editor/viewer）。
// 无权访问 403；不存在 404；public 白板对任意登录用户以 viewer 只读放行。
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const boardId = Number(params.id);
  const board = await getBoard(boardId);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });

  const role = boardRole(
    board.owner_user_id === user.id,
    await canViewRoom(board.room_id, user.id),
    board.visibility === "public"
  );
  if (!role) return NextResponse.json({ error: "无权限" }, { status: 403 });

  return NextResponse.json({ board, role });
}
