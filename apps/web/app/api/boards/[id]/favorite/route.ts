import { NextResponse } from "next/server";
import { addFavorite, canViewBoard, removeFavorite, resolveBoardId } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/boards/:id/favorite — 收藏（需可见该白板）
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const boardId = await resolveBoardId(params.id);
  if (!(await canViewBoard(boardId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  await addFavorite(boardId, user.id);
  return NextResponse.json({ ok: true, favorited: true });
}

// DELETE /api/boards/:id/favorite — 取消收藏
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const boardId = await resolveBoardId(params.id);
  await removeFavorite(boardId, user.id);
  return NextResponse.json({ ok: true, favorited: false });
}
