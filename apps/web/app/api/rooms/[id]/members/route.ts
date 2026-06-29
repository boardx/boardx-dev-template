import { NextResponse } from "next/server";
import { isRoomOwner, canViewRoom, listRoomMembers, addRoomMember } from "@repo/data";
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
  return NextResponse.json({ members: await listRoomMembers(roomId) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
    if (!(await isRoomOwner(roomId, user.id))) {
      return NextResponse.json({ error: "仅 owner 可加成员" }, { status: 403 });
    }
    const body = (await req.json()) as { userId?: unknown };
    const uid = Number(body.userId);
    if (!Number.isFinite(uid)) return NextResponse.json({ error: "userId 无效" }, { status: 400 });
    await addRoomMember(roomId, uid);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
