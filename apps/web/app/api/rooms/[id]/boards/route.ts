import { NextResponse } from "next/server";
import { canViewRoom, createBoard, getRoom, listBoardsInRoom, listFavoriteBoardIds, resolveRoomId } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/boards — 列出房间内白板（房间成员可见，否则 403）
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = await resolveRoomId(params.id);
  const room = await getRoom(roomId);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await canViewRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") ?? undefined;
  const tagsParam = sp.get("tags");
  const tags = tagsParam ? tagsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const [boards, favoriteIds] = await Promise.all([
    listBoardsInRoom(roomId, q, tags),
    listFavoriteBoardIds(user.id),
  ]);
  return NextResponse.json({ boards, favoriteIds });
}

// POST /api/rooms/:id/boards — 在房间内创建白板。空名→默认标题；非房间成员 403。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = await resolveRoomId(params.id);
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as { name?: unknown; tags?: unknown };
    const name = typeof body.name === "string" ? body.name : undefined;
    const tags = Array.isArray(body.tags)
      ? body.tags
          .filter((t): t is string => typeof t === "string")
          .map((s) => s.trim())
          // #519:单标签 ≤48 字符、最多 20 个(与 boards/:id PATCH 同限)。
          .filter((t) => t.length > 0 && t.length <= 48)
          .slice(0, 20)
      : [];
    const board = await createBoard(roomId, user.id, name, room.team_id, undefined, tags);
    return NextResponse.json({ board }, { status: 201 });
  } catch (err) {
    console.error("[rooms/:id/boards POST] 操作失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 }); // #519
  }
}
