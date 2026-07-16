import { NextResponse } from "next/server";
import { getValidEmailToken, consumeEmailToken, confirmUserEmail } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 邮箱确认（uc-auth-005，P21 F03）。
 *
 * 此前是硬编码 Set(["demo"]) 的内存桩；本轮改为真实读写 @repo/data 的一次性邮箱令牌，
 * 复用 reset-password 已验证过的 create/get/consume 机制（同一张 email_tokens 表，
 * type="confirm_email"，由 register 路由在注册时创建、24 小时过期）。
 *
 * 只覆盖主流程（注册邮箱确认）：token 有效 → 消费 token + 打 email_confirmed_at 时间戳。
 * 新邮箱变更确认（uc-auth-005 备选流程 A1）不在本次范围内，仍是 deferred。
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: unknown };
    const token = String(body.token ?? "").trim();
    if (!token) {
      return NextResponse.json(
        { error: "确认链接缺少必要信息" },
        { status: 400 },
      );
    }
    const rec = await getValidEmailToken(token, "confirm_email");
    if (!rec) {
      return NextResponse.json(
        { error: "确认链接无效或已过期" },
        { status: 400 },
      );
    }
    await consumeEmailToken(token); // 一次性：成功确认后立即失效，防重放
    await confirmUserEmail(rec.user_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
