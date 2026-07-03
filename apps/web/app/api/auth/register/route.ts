import { NextResponse } from "next/server";
import { validateRegister, normalizeEmail, hashPassword } from "@repo/auth";
import {
  createUser,
  findUserByEmail,
  listPendingRoomInvitesByEmail,
  addRoomMember,
  markRoomInviteAccepted,
} from "@repo/data";
import { startSession, toPublicUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // p20 F09：注册成功后按未过期（未 expire）的 pending 房间邀请自动入房，登录即见该房间。
    // 已过期的邀请不会被 listPendingRoomInvitesByEmail 返回（其 SQL 过滤 expires_at > now()），
    // 因此注册本身总是成功；只是不会自动入房——过期提示由前端在成员/房间入口另行展示。
    const invites = await listPendingRoomInvitesByEmail(email);
    for (const invite of invites) {
      await addRoomMember(invite.room_id, user.id, invite.role === "admin" ? "admin" : "member");
      await markRoomInviteAccepted(invite.id);
    }

    await startSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
