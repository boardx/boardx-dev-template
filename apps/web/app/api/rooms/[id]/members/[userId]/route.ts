import { NextResponse } from "next/server";
import { isRoomOwner, removeRoomMember } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string; userId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
    if (!(await isRoomOwner(roomId, user.id))) {
      return NextResponse.json({ error: "仅 owner 可移除成员" }, { status: 403 });
    }
    await removeRoomMember(roomId, Number(params.userId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
