import { NextResponse } from "next/server";
import { canManageRoom, expireRoomInvite } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 仅 dev/测试：把某房间下某邮箱的邀请强制标记为已过期，供 e2e 覆盖
 * "令牌过期→注册成功但不入房"场景。生产环境一律 404——绝不允许绕过真实的 7 天过期语义。
 *
 * review 修复（rev-security B2）：此前无鉴权、且按邮箱一把过期该邮箱在所有房间的邀请，
 * 是一个 IDOR + 跨房间越权洞——任何匿名请求都能让别人房间的邀请失效。现在要求：
 *  - 调用者已登录且对目标 roomId 有 owner/admin 权限（canManageRoom）；
 *  - 只影响该 roomId 下的这一条邀请（expireRoomInvite 按 room_id+email 收敛）。
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { email?: unknown; roomId?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  const roomId = Number(body.roomId);
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  if (!Number.isFinite(roomId)) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  if (!(await canManageRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  await expireRoomInvite(roomId, email);
  return NextResponse.json({ ok: true });
}
