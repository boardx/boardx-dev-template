import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import {
  canSubscribeAiStoreItem,
  getAiStoreItem,
  getAiStoreSubscription,
  getMembership,
  isAiStoreItemVisible,
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

  if (!isAiStoreItemVisible(item, user.id, teamId)) {
    return { error: NextResponse.json({ error: "未找到" }, { status: 404 }) } as const;
  }

  return { user, item, teamId } as const;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await loadContext(params.id);
    if ("error" in ctx) return ctx.error;
    const { user, item, teamId } = ctx;

    if (!canSubscribeAiStoreItem(item)) {
      return NextResponse.json({ error: "该项目尚未发布，无法订阅" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { scope?: string };
    const requestedScope = body.scope === "team" ? "team" : "personal";

    if (requestedScope === "team") {
      if (teamId == null) {
        return NextResponse.json({ error: "请先选择团队上下文" }, { status: 400 });
      }
      const role = await getMembership(teamId, user.id);
      if (role !== "owner" && role !== "admin") {
        return NextResponse.json({ error: "只有团队管理员可以团队订阅" }, { status: 403 });
      }
    }

    const subscription = await subscribeAiStoreItem({
      itemId: item.id,
      subscriberUserId: user.id,
      scope: requestedScope,
      teamId: requestedScope === "team" ? teamId : null,
    });

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await loadContext(params.id);
    if ("error" in ctx) return ctx.error;
    const { user, item, teamId } = ctx;

    const removed = await unsubscribeAiStoreItem({
      itemId: item.id,
      subscriberUserId: user.id,
      teamId,
    });
    if (!removed) return NextResponse.json({ error: "未找到订阅" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await loadContext(params.id);
  if ("error" in ctx) return ctx.error;
  const { user, item, teamId } = ctx;
  const subscription = await getAiStoreSubscription({ itemId: item.id, subscriberUserId: user.id, teamId });
  return NextResponse.json({ subscribed: Boolean(subscription), subscription: subscription ?? null });
}
