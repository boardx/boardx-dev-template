import { NextResponse } from "next/server";
import { getLatestTokenByEmail } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["reset_password", "confirm_email"]);

// 仅 dev/测试：取某邮箱最新有效邮件令牌，供 e2e 完成邮件流程。
// 生产环境一律 404——绝不暴露令牌。
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "";
  const type = url.searchParams.get("type") ?? "reset_password";
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ token: null }, { status: 400 });
  }
  const rec = await getLatestTokenByEmail(email, type);
  if (!rec) return NextResponse.json({ token: null }, { status: 404 });
  return NextResponse.json({ token: rec.token });
}
