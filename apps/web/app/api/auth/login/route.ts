import { NextResponse } from "next/server";
import {
  normalizeEmail,
  isValidEmail,
  verifyPassword,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
} from "@repo/auth";
import { findUserByEmail, recordAuthRateLimitEvent, countRecentAuthRateLimitEvents } from "@repo/data";
import { startSession, toPublicUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_ATTEMPT_KIND = "login_attempt";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    if (!isValidEmail(email) || password.length === 0) {
      return NextResponse.json({ error: "邮箱或密码无效" }, { status: 400 });
    }

    // 最小速率限制（P21 F03 加固）：同一邮箱短时间内登录尝试次数超限直接拒绝，防止无限次
    // 穷举密码。按归一化邮箱计数（不按 IP，避免共享 NAT/代理下误伤同网络的其它用户）。
    const recentAttempts = await countRecentAuthRateLimitEvents(
      email,
      LOGIN_ATTEMPT_KIND,
      LOGIN_RATE_LIMIT_WINDOW_MS
    );
    if (recentAttempts >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      return NextResponse.json({ error: "尝试次数过多，请稍后再试" }, { status: 429 });
    }
    await recordAuthRateLimitEvent(email, LOGIN_ATTEMPT_KIND);

    const user = await findUserByEmail(email);
    // 不区分"邮箱不存在"与"密码错误"，统一报「邮箱或密码无效」
    if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "邮箱或密码无效" }, { status: 401 });
    }
    await startSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
