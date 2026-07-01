import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canManageTeam, CURRENT_TEAM_COOKIE } from "@repo/auth";
import { getMembership } from "@repo/data";
import { currentUser } from "@/lib/session";
import { loadPersonalWallet, loadTeamWallet } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-credits-001-view-wallet —— Credit 钱包只读视图 API（真实 DB，CAP-DATA）。
// scope=personal（默认）：当前用户个人钱包。
// scope=team：当前团队钱包，仅 owner/admin 可见（member 返回 403）。
// 范围内只需「查看」：余额摘要 + 积分记录列表（usage / purchase）。
// 不接支付结算（F02/F05）、不接 AI 用量扣费（p9/p12）——两者后续复用 @repo/data 的 recordTransaction 写入。

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "team" ? "team" : "personal";
  const forceEmpty = url.searchParams.get("state") === "empty";

  if (scope === "team") {
    const teamId = cookies().get(CURRENT_TEAM_COOKIE)?.value;
    if (!teamId) return NextResponse.json({ error: "未选择团队" }, { status: 400 });
    const role = await getMembership(Number(teamId), user.id);
    if (!canManageTeam(role)) {
      return NextResponse.json({ error: "无权限查看团队 Credit 钱包" }, { status: 403 });
    }
    return NextResponse.json({ wallet: await loadTeamWallet(Number(teamId), forceEmpty) });
  }

  return NextResponse.json({
    wallet: await loadPersonalWallet(user.id, user.first_name || user.email, forceEmpty),
  });
}
