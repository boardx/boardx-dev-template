import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import {
  canAccessAiStoreItem,
  canSubscribeAiStoreItem,
  getAiStoreItem,
  getAiStoreSubscriptionAvailability,
  getMembership,
  subscribeAiStoreItem,
  unsubscribeAiStoreItem,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-ai-store-003：订阅/取消订阅 AI Store 项目。
// POST   /api/ai-store/items/:id/subscribe { scope: "personal" | "team" } — 订阅（幂等）。
// DELETE /api/ai-store/items/:id/subscribe — 取消订阅（当前团队上下文下的个人或团队订阅）。
async function loadContext(idParam: string) {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) } as const;

  const id = Number(idParam);
  if (!Number.isFinite(id)) return { error: NextResponse.json({ error: "无效 id" }, { status: 400 }) } as const;

  const item = await getAiStoreItem(id);
  if (!item) return { error: NextResponse.json({ error: "未找到" }, { status: 404 }) } as const;

  const teamIdCookie = cookies().get(CURRENT_TEAM_COOKIE)?.value;
  const teamId = teamIdCookie ? Number(teamIdCookie) : null;
  if (teamId == null || !Number.isFinite(teamId)) {
    return { error: NextResponse.json({ error: "请先选择团队上下文" }, { status: 400 }) } as const;
  }
  const role = await getMembership(teamId, user.id);
  if (!role) {
    return { error: NextResponse.json({ error: "当前团队不可用" }, { status: 403 }) } as const;
  }

  // 与详情路由（GET /api/ai-store/items/:id）用同一套可见性口径：canAccessAiStoreItem 在
  // isAiStoreItemVisible 之外还认 personal-scope 的已授权 grantee（F05 分享管理）。否则
  // 被分享授权查看某 personal 项目的用户会在详情页看到 Subscribe 按钮，点了却 404。
  if (!(await canAccessAiStoreItem(item, user.id, teamId))) {
    return { error: NextResponse.json({ error: "未找到" }, { status: 404 }) } as const;
  }

  return { user, item, teamId, role } as const;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await loadContext(params.id);
    if ("error" in ctx) return ctx.error;
    const { user, item, teamId, role } = ctx;

    if (!canSubscribeAiStoreItem(item)) {
      return NextResponse.json({ error: "该项目尚未发布，无法订阅" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { scope?: string };
    const requestedScope = body.scope === "team" ? "team" : "personal";

    if (requestedScope === "team") {
      if (role !== "owner" && role !== "admin") {
        return NextResponse.json({ error: "只有团队管理员可以团队订阅" }, { status: 403 });
      }
    }

    const result = await subscribeAiStoreItem({
      itemId: item.id,
      subscriberUserId: user.id,
      scope: requestedScope,
      consumerTeamId: teamId,
    });

    return NextResponse.json(
      { subscription: result.subscription, idempotent: !result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (err) {
    console.error("[ai-store/items/:id/subscribe] subscribe failed", err);
    return NextResponse.json({ error: "订阅失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await loadContext(params.id);
    if ("error" in ctx) return ctx.error;
    const { user, item, teamId, role } = ctx;
    const scope = new URL(req.url).searchParams.get("scope") === "team" ? "team" : "personal";
    if (scope === "team" && role !== "owner" && role !== "admin") {
      return NextResponse.json({ error: "只有团队管理员可以取消团队订阅" }, { status: 403 });
    }

    const removed = await unsubscribeAiStoreItem({
      itemId: item.id,
      subscriberUserId: user.id,
      consumerTeamId: teamId,
      scope,
    });
    if (!removed) return NextResponse.json({ error: "未找到订阅" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ai-store/items/:id/subscribe] unsubscribe failed", err);
    return NextResponse.json({ error: "取消订阅失败" }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await loadContext(params.id);
  if ("error" in ctx) return ctx.error;
  const { user, item, teamId, role } = ctx;
  const availability = await getAiStoreSubscriptionAvailability({
    itemId: item.id,
    subscriberUserId: user.id,
    consumerTeamId: teamId,
  });
  return NextResponse.json({
    subscribed: Boolean(availability.personal || availability.team),
    personal: Boolean(availability.personal),
    team: Boolean(availability.team),
    canManageTeam: role === "owner" || role === "admin",
    subscriptions: availability,
  });
}
