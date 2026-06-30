import { NextResponse } from "next/server";
import {
  canViewRoom,
  canManageRoom,
  getRoomRole,
  listRoomMembers,
  addRoomMember,
  findUserByEmail,
} from "@repo/data";
import { isValidEmail, normalizeEmail, generateToken } from "@repo/auth";
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
  const role = await getRoomRole(roomId, user.id);
  return NextResponse.json({ members: await listRoomMembers(roomId), myRole: role ?? null });
}

/**
 * 邀请成员（uc-room-003）。owner/admin only。
 * POST { email }  → 邮箱邀请：已注册且不在房间 → 加入为 member（status:"added"）；
 *                    已在房间 → userAlreadyInRoom(409)；未注册 → 邀请流程（status:"invited"）。
 * POST { userId } → 直接按 userId 加入为 member（兼容既有 room-manage API）。
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
    if (!(await canManageRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限邀请" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as { userId?: unknown; email?: unknown };

    // 兼容旧路径：按 userId 直接加成员
    if (body.userId !== undefined) {
      const uid = Number(body.userId);
      if (!Number.isFinite(uid)) return NextResponse.json({ error: "userId 无效" }, { status: 400 });
      await addRoomMember(roomId, uid);
      return NextResponse.json({ ok: true, status: "added" }, { status: 201 });
    }

    // 邮箱邀请
    const rawEmail = String(body.email ?? "").trim();
    if (!rawEmail) return NextResponse.json({ error: "请输入邮箱地址" }, { status: 400 });
    if (!isValidEmail(rawEmail)) return NextResponse.json({ error: "invalidEmail" }, { status: 400 });
    const email = normalizeEmail(rawEmail);

    const existing = await findUserByEmail(email);
    if (existing) {
      if (await getRoomRole(roomId, existing.id)) {
        return NextResponse.json({ error: "userAlreadyInRoom" }, { status: 409 });
      }
      await addRoomMember(roomId, existing.id);
      return NextResponse.json({ status: "added", email }, { status: 200 });
    }

    // 未注册邮箱：交由邀请流程处理（生成一次性 token，可拼成邀请链接）。
    // 注：当前阶段不落 room_invites 表，token 仅用于前端展示/复制链接，邮件发送在范围外。
    const token = generateToken();
    return NextResponse.json({ status: "invited", email, token }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
