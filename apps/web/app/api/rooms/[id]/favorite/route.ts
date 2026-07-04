import { NextResponse } from "next/server";
import { canViewRoom, addRoomFavorite, removeRoomFavorite } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/rooms/:id/favorite — 收藏（需是该房间成员，即 canViewRoom）
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = Number(params.id);
  if (!(await canViewRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  await addRoomFavorite(roomId, user.id);
  return NextResponse.json({ ok: true, favorited: true });
}

// DELETE /api/rooms/:id/favorite — 取消收藏
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = Number(params.id);
  if (!(await canViewRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  await removeRoomFavorite(roomId, user.id);
  return NextResponse.json({ ok: true, favorited: false });
}
