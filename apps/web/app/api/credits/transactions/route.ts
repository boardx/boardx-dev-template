import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canManageTeam, CURRENT_TEAM_COOKIE } from "@repo/auth";
import { getMembership, getOrCreatePersonalWallet, getOrCreateTeamWallet } from "@repo/data";
import { currentUser } from "@/lib/session";
import { seedDemoIfEmpty, transactionsToPayload } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-credits-003-view-credit-records —— Credit 流水分页查看 API（真实 DB，CAP-DATA）。
// scope=personal（默认）：当前用户个人钱包流水，供用户菜单「Credit Records」弹窗使用。
// scope=team：当前团队钱包流水，仅 owner/admin 可见（member 返回 403），供 Team Credits 页面使用。
// kind=usage|purchase：可选过滤（对应 Team Credits 页面 Usage/Purchase 标签页）。
// page/pageSize：1-based 分页；返回 total 供前端判断是否还有更多。
// 越权范围不可见：普通用户拿不到 scope=team 的数据（403），team 钱包只暴露给管理角色。

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "team" ? "team" : "personal";
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam === "usage" || kindParam === "purchase" ? kindParam : undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));
  const forceEmpty = url.searchParams.get("state") === "empty";

  if (scope === "team") {
    const teamId = cookies().get(CURRENT_TEAM_COOKIE)?.value;
    if (!teamId) return NextResponse.json({ error: "未选择团队" }, { status: 400 });
    const role = await getMembership(Number(teamId), user.id);
    if (!canManageTeam(role)) {
      return NextResponse.json({ error: "无权限查看团队 Credit 流水" }, { status: 403 });
    }
    const wallet = await getOrCreateTeamWallet(Number(teamId));
    if (!forceEmpty) await seedDemoIfEmpty(wallet, "Team usage");
    const payload = await transactionsToPayload(wallet.id, { page, pageSize, kind });
    return NextResponse.json(payload);
  }

  const wallet = await getOrCreatePersonalWallet(user.id);
  if (!forceEmpty) await seedDemoIfEmpty(wallet, user.first_name || user.email);
  const payload = await transactionsToPayload(wallet.id, { page, pageSize, kind });
  return NextResponse.json(payload);
}
