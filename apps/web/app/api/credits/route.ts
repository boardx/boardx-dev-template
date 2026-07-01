import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { loadPersonalWallet } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-credits-001-view-wallet —— 兼容旧路径：等价于 GET /api/credits/wallet?scope=personal。
// 真实实现 + team scope + 权限见 app/api/credits/wallet/route.ts（共用 lib/credits.ts）。

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const forceEmpty = new URL(req.url).searchParams.get("state") === "empty";
  return NextResponse.json({
    wallet: await loadPersonalWallet(user.id, user.first_name || user.email, forceEmpty),
  });
}
