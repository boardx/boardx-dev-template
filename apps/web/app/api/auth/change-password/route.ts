import { NextResponse } from "next/server";
import { isValidPassword, verifyPassword, hashPassword } from "@repo/auth";
import { updateUserPassword, deleteUserSessions } from "@repo/data";
import { currentUser, endSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    if (!user.password_hash) {
      return NextResponse.json({ error: "该账号非邮箱密码账号" }, { status: 400 });
    }
    const body = (await req.json()) as { current?: unknown; next?: unknown };
    const current = String(body.current ?? "");
    const next = String(body.next ?? "");
    if (!isValidPassword(next)) {
      return NextResponse.json({ errors: { next: "新密码至少 6 位" } }, { status: 400 });
    }
    if (!(await verifyPassword(current, user.password_hash))) {
      return NextResponse.json({ errors: { current: "当前密码不正确" } }, { status: 400 });
    }
    await updateUserPassword(user.id, await hashPassword(next));
    await deleteUserSessions(user.id); // 改密后所有会话失效
    await endSession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
