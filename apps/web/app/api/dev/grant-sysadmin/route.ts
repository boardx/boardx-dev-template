import { NextResponse } from "next/server";
import { findUserByEmail, setPlatformRole } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 仅 dev/测试：把某邮箱对应的用户提升为平台 SysAdmin，供 e2e 覆盖 /admin 门控正向路径。
// 生产环境一律 404——绝不允许绕过真实的角色提升流程（人工在库里改，或未来的运营后台）。
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const user = await findUserByEmail(email);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  await setPlatformRole(user.id, "sysadmin");
  return NextResponse.json({ ok: true });
}
