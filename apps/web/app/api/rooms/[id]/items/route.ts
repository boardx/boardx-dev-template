import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { canViewRoom, listRoomItems, insertItem, type BoardItemRow } from "@repo/data";
import { DEFAULT_SIZE, validateNewItem, isItemType } from "@repo/canvas";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = Number(params.id);
  if (!(await canViewRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  return NextResponse.json({ items: await listRoomItems(roomId) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const body = (await req.json()) as { type?: unknown; x?: unknown; y?: unknown; text?: unknown };
    const v = validateNewItem(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const type = isItemType(String(body.type)) ? (body.type as "note" | "rect") : "note";
    const size = DEFAULT_SIZE[type];
    const item: BoardItemRow = {
      id: randomUUID(),
      room_id: roomId,
      type,
      x: Math.trunc(Number(body.x)),
      y: Math.trunc(Number(body.y)),
      w: size.w,
      h: size.h,
      text: typeof body.text === "string" ? body.text : "",
    };
    return NextResponse.json({ item: await insertItem(item) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
