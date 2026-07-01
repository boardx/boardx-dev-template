import { NextResponse } from "next/server";
import { getPlatformStats } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-005 — 后台首页统计摘要 API。
// 范围：用户数/团队数聚合自真实表（users/teams）。AI Store 项目数依赖 p11 的
// ai_store_items（该表尚未落地，p11 仍在并行开发中），因此这里返回 mock:true 的占位值，
// 前端据此渲染"占位"标注，绝不假装成真实聚合。
export async function GET() {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const { userCount, teamCount } = await getPlatformStats();

  return NextResponse.json({
    stats: {
      users: { value: userCount, mock: false },
      teams: { value: teamCount, mock: false },
      // ai-store 计数依赖 p11 ai_store_items（尚未建表/并行开发中）—— 占位值，前端标注"占位"。
      aiStoreItems: { value: 0, mock: true },
    },
  });
}
