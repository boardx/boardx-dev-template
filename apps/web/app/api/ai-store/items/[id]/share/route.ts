// apps/web/app/api/ai-store/items/[id]/share/route.ts — P11 F05 AI Store 项目分享管理
// GET  取当前分享状态 + 已授权用户列表（owner-only）。
// POST 生成/重新开启管理授权链接（owner-only；已开启时复用同一 token，见 enableAiStoreItemShare）。
// DELETE 关闭分享链接，使旧链接立即失效（owner-only；不清空已授权用户列表）。
import { NextResponse } from "next/server";
import {
  disableAiStoreItemShare,
  enableAiStoreItemShare,
  getAiStoreItem,
  getAiStoreItemShare,
  listAiStoreItemGrantees,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseItemId(raw: string): number | undefined {
  const id = Number(raw);
  return Number.isFinite(id) ? id : undefined;
}

type OwnedItemResult =
  | { ok: true; itemId: number }
  | { ok: false; response: NextResponse };

// 分享管理入口只对项目拥有者开放（uc-ai-store-005 权限规则 1：只有创建者或具备授权管理
// 关系的用户可见入口——本 feature 范围内的“管理分享设置本身”仅限拥有者，被授权协作者
// 只能在授权范围内管理项目内容，不能开关分享/移除其他协作者，见 notes 的 scope 边界）。
// 绝不信任客户端传来的 id：每次都重新从数据库取项目并比对 owner_user_id。
async function requireOwnedItem(rawId: string): Promise<OwnedItemResult> {
  const user = await currentUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "未登录" }, { status: 401 }) };

  const itemId = parseItemId(rawId);
  if (itemId == null) {
    return { ok: false, response: NextResponse.json({ error: "无效的项目 id" }, { status: 400 }) };
  }

  const item = await getAiStoreItem(itemId);
  if (!item || item.owner_user_id == null || String(item.owner_user_id) !== String(user.id)) {
    return { ok: false, response: NextResponse.json({ error: "项目不存在或无权限" }, { status: 404 }) };
  }
  return { ok: true, itemId };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const checked = await requireOwnedItem(params.id);
  if (!checked.ok) return checked.response;
  const share = await getAiStoreItemShare(checked.itemId);
  const grantees = await listAiStoreItemGrantees(checked.itemId);
  return NextResponse.json({ share: share ?? null, grantees });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const checked = await requireOwnedItem(params.id);
    if (!checked.ok) return checked.response;
    const share = await enableAiStoreItemShare(checked.itemId);
    if (!share) return NextResponse.json({ error: "项目不存在或无权限" }, { status: 404 });
    return NextResponse.json({ share }, { status: 201 });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const checked = await requireOwnedItem(params.id);
    if (!checked.ok) return checked.response;
    const share = await disableAiStoreItemShare(checked.itemId);
    if (!share) return NextResponse.json({ error: "项目不存在或无权限" }, { status: 404 });
    return NextResponse.json({ share });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
