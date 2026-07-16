import { NextResponse } from "next/server";
import { isValidPassword, hashPassword } from "@repo/auth";
import {
  getValidEmailToken,
  consumeEmailToken,
  updateUserPassword,
  deleteUserSessions,
} from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: unknown; next?: unknown };
    const token = String(body.token ?? "");
    const next = String(body.next ?? "");
    if (!isValidPassword(next)) {
      return NextResponse.json({ errors: { next: "新密码至少 6 位" } }, { status: 400 });
    }
    const rec = await getValidEmailToken(token, "reset_password");
    if (!rec) {
      return NextResponse.json({ error: "重置链接无效或已过期" }, { status: 400 });
    }
    await updateUserPassword(rec.user_id, await hashPassword(next));
    await consumeEmailToken(token); // 一次性
    await deleteUserSessions(rec.user_id); // 重置后旧会话失效
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
