import { NextResponse } from "next/server";
import { normalizeEmail, isValidEmail, verifyPassword } from "@repo/auth";
import { findUserByEmail } from "@repo/data";
import { startSession, toPublicUser } from "@/lib/session";
import { hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    if (!isValidEmail(email) || password.length === 0) {
      return NextResponse.json({ error: "邮箱或密码无效" }, { status: 400 });
    }
    if (hitRateLimit(`auth-login:${email}`, 5, 60_000)) {
      return NextResponse.json({ error: "登录尝试过于频繁，请稍后再试" }, { status: 429 });
    }
    const user = await findUserByEmail(email);
    // 不区分"邮箱不存在"与"密码错误"，统一报「邮箱或密码无效」
    if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "邮箱或密码无效" }, { status: 401 });
    }
    await startSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error("[auth/login] 登录失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
