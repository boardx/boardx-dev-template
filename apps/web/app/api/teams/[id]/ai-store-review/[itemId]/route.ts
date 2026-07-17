// apps/web/app/api/teams/[id]/ai-store-review/[itemId]/route.ts — P11 F06 团队审核动作
// POST body { action: "approve" | "reject" | "withdraw" }：团队管理角色（owner/admin）
// 批准（PENDING→published）、拒绝（PENDING→rejected）、撤回已批准项目（published→PENDING）。
// 复用 reviewTeamAiStoreItem 的状态机 + team_id 绑定校验（同一次 UPDATE 内完成合法性 +
// 越权校验，见 packages/data/src/aiStore.ts 注释）；不满足条件时统一 404，不区分"不存在"
// 还是"状态不允许"，避免探测团队内部数据。
import { NextResponse } from "next/server";
import { canManageTeam } from "@repo/auth";
import {
  getAiStoreItem,
  getMembership,
  reviewTeamAiStoreItem,
  type TeamAiStoreReviewAction,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ACTIONS: TeamAiStoreReviewAction[] = ["approve", "reject", "withdraw"];

export async function POST(req: Request, { params }: { params: { id: string; itemId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const teamId = Number(params.id);
    const itemId = Number(params.itemId);
    if (!Number.isFinite(teamId) || !Number.isFinite(itemId)) {
      return NextResponse.json({ error: "无效的 id" }, { status: 400 });
    }

    if (!canManageTeam(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { action?: unknown };
    const actionRaw = String(body.action ?? "");
    if (!VALID_ACTIONS.includes(actionRaw as TeamAiStoreReviewAction)) {
      return NextResponse.json({ error: "无效的审核动作" }, { status: 400 });
    }
    const action = actionRaw as TeamAiStoreReviewAction;

    const item = await reviewTeamAiStoreItem(itemId, teamId, action);
    if (!item) {
      const existing = await getAiStoreItem(itemId);
      if (
        existing &&
        existing.scope === "team" &&
        String(existing.origin_team_id) === String(teamId)
      ) {
        return NextResponse.json({ error: "当前状态不支持该审核操作" }, { status: 409 });
      }
      return NextResponse.json({ error: "项目不存在或不属于该团队" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
