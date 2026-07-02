import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canManageTeam, CURRENT_TEAM_COOKIE } from "@repo/auth";
import { getMembership } from "@repo/data";
import { currentUser } from "@/lib/session";
import { loadPersonalTransactions, loadTeamTransactions } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readPositiveInt = (value: string | null, fallback: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
};

// uc-credits-003-view-credit-records —— paginated read model for personal/team credit records.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "team" ? "team" : "personal";
  const page = readPositiveInt(url.searchParams.get("page"), 1, 10_000);
  const pageSize = readPositiveInt(url.searchParams.get("pageSize"), 10, 50);
  const forceEmpty = url.searchParams.get("state") === "empty";

  if (scope === "team") {
    const teamId = cookies().get(CURRENT_TEAM_COOKIE)?.value;
    if (!teamId) return NextResponse.json({ error: "未选择团队" }, { status: 400 });
    const role = await getMembership(Number(teamId), user.id);
    if (!canManageTeam(role)) {
      return NextResponse.json({ error: "无权限查看团队 Credit 记录" }, { status: 403 });
    }
    return NextResponse.json({
      records: await loadTeamTransactions(Number(teamId), { page, pageSize, forceEmpty }),
    });
  }

  return NextResponse.json({
    records: await loadPersonalTransactions(user.id, user.first_name || user.email, {
      page,
      pageSize,
      forceEmpty,
    }),
  });
}
