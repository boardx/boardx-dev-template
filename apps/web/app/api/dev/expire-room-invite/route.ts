import { NextResponse } from "next/server";
import { expireRoomInviteByEmail } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 仅 dev/测试：把某邮箱的房间邀请强制标记为已过期，供 e2e 覆盖"令牌过期→注册成功但不入房"场景。
// 生产环境一律 404——绝不允许绕过真实的 7 天过期语义。
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  await expireRoomInviteByEmail(email);
  return NextResponse.json({ ok: true });
}
