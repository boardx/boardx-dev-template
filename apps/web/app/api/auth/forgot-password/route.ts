import { NextResponse } from "next/server";
import { normalizeEmail, isValidEmail, generateToken, expiresAt, RESET_TOKEN_TTL_MS } from "@repo/auth";
import { findUserByEmail, createEmailToken } from "@repo/data";
import { sendResetPasswordEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: unknown };
    const email = normalizeEmail(String(body.email ?? ""));
    if (!isValidEmail(email)) {
      return NextResponse.json({ errors: { email: "邮箱格式无效" } }, { status: 400 });
    }
    const user = await findUserByEmail(email);
    // 存在且为邮箱账号才发信；但响应统一成功，不泄露邮箱是否注册。
    if (user && user.password_hash) {
      const token = generateToken();
      await createEmailToken(token, user.id, "reset_password", expiresAt(RESET_TOKEN_TTL_MS));
      const origin = new URL(req.url).origin;
      await sendResetPasswordEmail({
        to: email,
        token,
        resetUrl: `${origin}/reset-password?token=${token}`,
      });
    }
    // 关键：响应绝不返回 token / resetUrl。
    return NextResponse.json({ ok: true, message: "若该邮箱已注册，重置链接已发送" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
