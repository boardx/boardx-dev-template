import { NextResponse } from "next/server";
import { canManageRoom, revokeRoomInvite } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 撤销未注册邮箱邀请（p20 F09）。owner/admin only。撤销后令牌失效，注册也不会自动入房。 */
export async function DELETE(_req: Request, { params }: { params: { id: string; inviteId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
    const inviteId = Number(params.inviteId);
    if (!(await canManageRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const ok = await revokeRoomInvite(roomId, inviteId);
    if (!ok) return NextResponse.json({ error: "邀请不存在或已处理" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[rooms/invites] 撤销邀请失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
