import { NextResponse } from "next/server";
import { getLatestTokenByEmail } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 仅 dev/测试：取某邮箱最新有效的重置令牌，供 e2e 完成重置流程。
// 生产环境一律 404——绝不暴露令牌。
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const email = new URL(req.url).searchParams.get("email") ?? "";
  const rec = await getLatestTokenByEmail(email, "reset_password");
  if (!rec) return NextResponse.json({ token: null }, { status: 404 });
  return NextResponse.json({ token: rec.token });
}
