import { NextResponse } from "next/server";
import { consumeEmailToken, getValidEmailToken } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    await consumeEmailToken(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/confirm-email] 确认邮箱失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
