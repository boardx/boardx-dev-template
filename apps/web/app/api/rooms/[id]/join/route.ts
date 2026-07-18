import { NextResponse } from "next/server";
import { addRoomMember, getMembership, getRoom, getRoomRole, resolveRoomId } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 加入房间（uc-rr-002）。仅 visibility=team 的房间允许**同团队成员**自助加入为 member；
 * private 房间只能被邀请，任何自助加入一律 403（对非成员不可见的现有行为不变）。
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const roomId = await resolveRoomId(params.id);
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: "房间不存在" }, { status: 404 });

    // 已是成员：幂等成功
    if (await getRoomRole(roomId, user.id)) {
      return NextResponse.json({ ok: true, alreadyMember: true });
    }

    // 仅 team 可见 + 同团队成员可自助加入
    const canJoin =
      room.visibility === "team" && room.team_id != null && (await getMembership(room.team_id, user.id));
    if (!canJoin) return NextResponse.json({ error: "无权限加入该房间" }, { status: 403 });

    await addRoomMember(roomId, user.id, "member");
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部错误细节只落服务端日志，不回给客户端
    console.error("[rooms/join] 加入房间失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
