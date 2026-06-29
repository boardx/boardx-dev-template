import { NextResponse } from "next/server";
import { normalizeEmail, isValidEmail, verifyPassword } from "@repo/auth";
import { findUserByEmail } from "@repo/data";
import { startSession, toPublicUser } from "@/lib/session";

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
    const user = await findUserByEmail(email);
    // 不区分"邮箱不存在"与"密码错误"，统一报「邮箱或密码无效」
    if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "邮箱或密码无效" }, { status: 401 });
    }
    await startSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
