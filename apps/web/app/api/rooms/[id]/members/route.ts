import { NextResponse } from "next/server";
import {
  canViewRoom,
  canManageRoom,
  getRoomRole,
  getRoom,
  listRoomMembers,
  addRoomMember,
  findUserByEmail,
  upsertRoomInvite,
  listPendingRoomInvites,
} from "@repo/data";
import { isValidEmail, normalizeEmail, generateToken, expiresAt, ROOM_INVITE_TTL_MS } from "@repo/auth";
import { currentUser } from "@/lib/session";
import { sendRoomInviteEmail } from "@/lib/mailer";

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
  const canManage = role === "owner" || role === "admin";
  // pending 邀请列表仅 owner/admin 可见（避免向普通成员泄漏邀请邮箱等细节）。
  const invites = canManage ? await listPendingRoomInvites(roomId) : [];
  return NextResponse.json({
    members: await listRoomMembers(roomId),
    myRole: role ?? null,
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      expires_at: i.expires_at,
      created_at: i.created_at,
    })),
  });
}

/**
 * 邀请成员（uc-room-003 / p20 F09）。owner/admin only。
 * POST { email }  → 邮箱邀请：已注册且不在房间 → 加入为 member（status:"added"）；
 *                    已在房间 → userAlreadyInRoom(409)；未注册 → room_invites 落库
 *                    （token/过期7天/幂等刷新）+ dev 邮件通道发送注册链接（status:"invited"）。
 * POST { userId } → 直接按 userId 加入为 member（兼容既有 room-manage API）。
 *
 * 安全（review 修正 M2）：token 只经邮件（dev=控制台日志+outbound_emails 落库）流转给
 * 被邀者本人，响应体绝不返回 token。但响应确实会区分"该邮箱已注册"(added/409) 与
 * "未注册"(invited) —— 这是 owner/admin 已有权限查看的信息（他们本来就在管理这个房间的
 * 成员），产品上认为可接受；不去假装两者不可区分。真正需要保密的是 token 本身与
 * "该邮箱是否已被邀请过"这类细节，这两点不经响应体或口径不一致的状态码泄漏。
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

    // 未注册邮箱：持久化邀请（幂等：同房间+同邮箱刷新 token/过期时间，不产生重复行）
    // 并经 dev 邮件通道发送注册链接。token 绝不放进响应体，只经邮件流转给被邀者本人；
    // 注册链接携带 token（而不只是 email）——接受邀请时靠 token 而不是"邮箱匹配"来鉴权
    // （rev-security B1 修复：此前注册钩子纯按邮箱入房，任何人猜到邮箱曾被邀请即可冒领）。
    const token = generateToken();
    await upsertRoomInvite(roomId, email, token, user.id, expiresAt(ROOM_INVITE_TTL_MS));
    const room = await getRoom(roomId);
    const origin = new URL(req.url).origin;
    await sendRoomInviteEmail({
      to: email,
      roomName: room?.name ?? `房间 #${roomId}`,
      inviterEmail: user.email,
      registerUrl: `${origin}/register?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
    });
    return NextResponse.json({ status: "invited", email }, { status: 200 });
  } catch (err) {
    console.error("[rooms/members] 操作失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
