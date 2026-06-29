import { NextResponse } from "next/server";
import { getRoom, canViewRoom, createBoard, listBoardsInRoom } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/boards — 列出房间内白板（房间成员可见，否则 403）
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = Number(params.id);
  const room = await getRoom(roomId);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await canViewRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  return NextResponse.json({ boards: await listBoardsInRoom(roomId) });
}

// POST /api/rooms/:id/boards — 在房间内创建白板。空名→默认标题；非房间成员 403。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name : undefined;
    const board = await createBoard(roomId, user.id, name, room.team_id);
    return NextResponse.json({ board }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
