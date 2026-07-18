import { NextResponse } from "next/server";
import { getRoomRole, removeRoomMember, resolveRoomId, updateRoomMemberRole } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 改成员角色（uc-rr-006 权限矩阵）。提升/降级 admin 仅 owner；member↔admin；不能改 owner。 */
export async function PATCH(req: Request, { params }: { params: { id: string; userId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = await resolveRoomId(params.id);
    const targetId = Number(params.userId);
    const myRole = await getRoomRole(roomId, user.id);
    if (myRole !== "owner") {
      return NextResponse.json({ error: "仅 owner 可提升/降级 admin" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as { role?: unknown };
    const role = body.role === "admin" ? "admin" : body.role === "member" ? "member" : null;
    if (!role) return NextResponse.json({ error: "role 无效" }, { status: 400 });

    const targetRole = await getRoomRole(roomId, targetId);
    if (!targetRole) return NextResponse.json({ error: "成员不存在" }, { status: 404 });
    if (targetRole === "owner") return NextResponse.json({ error: "不能修改 owner" }, { status: 403 });

    await updateRoomMemberRole(roomId, targetId, role);
    return NextResponse.json({ ok: true, role });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

/** 移除成员（uc-room-003）。owner/admin only。owner 不可被移除；admin 不能移除另一个 admin。 */
export async function DELETE(_req: Request, { params }: { params: { id: string; userId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = await resolveRoomId(params.id);
    const targetId = Number(params.userId);

    const myRole = await getRoomRole(roomId, user.id);
    if (myRole !== "owner" && myRole !== "admin") {
      return NextResponse.json({ error: "无权限移除成员" }, { status: 403 });
    }

    const targetRole = await getRoomRole(roomId, targetId);
    if (targetRole === "owner") {
      return NextResponse.json({ error: "不能移除 owner" }, { status: 403 });
    }
    if (myRole === "admin" && targetRole === "admin") {
      return NextResponse.json({ error: "adminRemoveUser" }, { status: 403 });
    }

    await removeRoomMember(roomId, targetId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
