import { NextResponse } from "next/server";
import { validateRegister, normalizeEmail, hashPassword, generateToken, expiresAt, RESET_TOKEN_TTL_MS } from "@repo/auth";
import {
  createEmailToken,
  createUser,
  findUserByEmail,
  getRoomInviteByToken,
  getRoom,
  addRoomMember,
  markRoomInviteAccepted,
} from "@repo/data";
import { startSession, toPublicUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * p20 F09 review 修复（rev-security B1）：接受房间邀请必须消费 token，不能纯按邮箱匹配自动入房
 * ——否则任何人猜到/得知某邮箱被邀请过，自行用该邮箱注册即可冒领邀请，无需持有邮件里的秘密。
 *
 * 只处理"注册链接携带的这一个 token"对应的邀请；同一邮箱可能同时在多个房间有 pending 邀请，
 * 但每条注册链接只携带一个 token，也就只消费它指向的那一条——这是有意为之：token 是"凭证"，
 * 没有 token 的其它邀请不会被这次注册顺带消费，被邀者需要分别点开每封邀请邮件的链接。
 *
 * 返回 null（未入房）时区分两种前端可提示的场景：
 *  - "unknown"：token 不存在/不是这个邮箱的/已被撤销或已接受过 —— 不透露细节，静默忽略。
 *  - "expired"：token 存在、邮箱匹配，但已过期 —— 按 uc-rr-008 E1 契约需要提示"邀请已过期"。
 */
async function tryAcceptRoomInvite(
  token: string,
  email: string,
  userId: number
): Promise<{ joinedRoomId: number; roomName: string } | { expiredRoomName: string } | null> {
  const invite = await getRoomInviteByToken(token);
  if (!invite) return null;
  // token 必须属于这次注册的邮箱，且必须仍是 pending——已撤销/已接受的 token 不能再次生效。
  if (invite.email !== email || invite.status !== "pending") return null;

  const room = await getRoom(invite.room_id);
  const roomName = room?.name ?? `房间 #${invite.room_id}`;
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return { expiredRoomName: roomName };
  }

  await addRoomMember(invite.room_id, userId, "member");
  await markRoomInviteAccepted(invite.id);
  return { joinedRoomId: invite.room_id, roomName };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const input = {
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      agreeTerms: body.agreeTerms === true,
    };
    const roomInviteToken = typeof body.roomInviteToken === "string" ? body.roomInviteToken.trim() : "";
    const errors = validateRegister(input);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }
    const email = normalizeEmail(input.email);
    if (await findUserByEmail(email)) {
      return NextResponse.json({ errors: { email: "该邮箱已注册" } }, { status: 409 });
    }
    const user = await createUser({
      email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
    });

    // "注册必成功登录"是本路由的主不变量：先建立会话，再处理房间邀请这个次要副作用
    // （rev-code major 2）。startSession 之后即便邀请处理出错，用户也已能正常登录。
    await startSession(user.id);
    await createEmailToken(generateToken(), user.id, "confirm_email", expiresAt(RESET_TOKEN_TTL_MS));

    // 邀请处理整体包一层 try/catch，任何异常只记日志、绝不让整个注册请求 500
    // （rev-code major 1：此前若这段抛错，会导致"账号已建但未登录、邮箱被占用"的坏状态）。
    let roomInvite: { joinedRoomId: number; roomName: string } | { expiredRoomName: string } | null = null;
    if (roomInviteToken) {
      try {
        roomInvite = await tryAcceptRoomInvite(roomInviteToken, email, user.id);
      } catch (err) {
        console.error("[register] room invite accept failed:", err);
      }
    }

    return NextResponse.json(
      {
        user: toPublicUser(user),
        roomInvite:
          roomInvite && "expiredRoomName" in roomInvite
            ? { status: "expired", roomName: roomInvite.expiredRoomName }
            : roomInvite
              ? { status: "joined", roomId: roomInvite.joinedRoomId, roomName: roomInvite.roomName }
              : null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[auth/register] 注册失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
