import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 邮箱确认 — 原型内存桩（in-memory stub）。
 *
 * 真实实现应查 @repo/data 的一次性邮箱令牌（同 reset-password 的
 * getValidEmailToken/consumeEmailToken 模式），区分注册确认与新邮箱变更，
 * 校验链接归属当前用户/目标邮箱，并更新邮箱确认/绑定状态（见 UC-AUTH-005 主流程 4–7、E1–E4）。
 * 此处为前端原型提供确定性桩：已知 token `demo` → 成功；其余 → 链接无效或已过期。
 */
const KNOWN_TOKENS = new Set(["demo"]);

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
    if (!KNOWN_TOKENS.has(token)) {
      return NextResponse.json(
        { error: "确认链接无效或已过期" },
        { status: 400 },
      );
    }
    // 成功：注册邮箱确认状态 / 新邮箱绑定状态被更新（桩）。
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
