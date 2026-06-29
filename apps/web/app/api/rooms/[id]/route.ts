import { NextResponse } from "next/server";
import { getRoom, canViewRoom, isRoomOwner, updateRoom, deleteRoom, type RoomVisibility } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = Number(params.id);
  const room = await getRoom(roomId);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await canViewRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  return NextResponse.json({ room });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
    if (!(await isRoomOwner(roomId, user.id))) {
      return NextResponse.json({ error: "仅 owner 可修改" }, { status: 403 });
    }
    const body = (await req.json()) as { name?: unknown; visibility?: unknown };
    const fields: { name?: string; visibility?: RoomVisibility } = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ errors: { name: "房间名不能为空" } }, { status: 400 });
      fields.name = name;
    }
    if (body.visibility !== undefined) fields.visibility = body.visibility === "team" ? "team" : "private";
    await updateRoom(roomId, fields);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
    if (!(await isRoomOwner(roomId, user.id))) {
      return NextResponse.json({ error: "仅 owner 可删除" }, { status: 403 });
    }
    await deleteRoom(roomId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
