import { NextResponse } from "next/server";
import { getItem, getBoardAccessRole, updateItem, deleteItem } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireEdit(itemId: string, userId: number) {
  const item = await getItem(itemId);
  if (!item || item.board_id == null) return { error: "not found", status: 404 as const };
  const role = await getBoardAccessRole(Number(item.board_id), userId);
  if (role !== "owner" && role !== "editor") return { error: "无编辑权限", status: 403 as const };
  return { item };
}

// PATCH /api/board-items/:itemId — 移动/编辑（owner/editor）。
export async function PATCH(req: Request, { params }: { params: { itemId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const gate = await requireEdit(params.itemId, user.id);
    if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const body = (await req.json().catch(() => ({}))) as {
      x?: unknown; y?: unknown; w?: unknown; h?: unknown; text?: unknown; color?: unknown;
    };
    const fields: { x?: number; y?: number; w?: number; h?: number; text?: string; color?: string | null } = {};
    if (body.x !== undefined && body.y !== undefined) {
      fields.x = Math.trunc(Number(body.x));
      fields.y = Math.trunc(Number(body.y));
    }
    // p6:F07 组件缩放落库：w/h 成对提交，最小 8px 防退化。
    if (body.w !== undefined && body.h !== undefined) {
      fields.w = Math.max(8, Math.trunc(Number(body.w)));
      fields.h = Math.max(8, Math.trunc(Number(body.h)));
    }
    if (typeof body.text === "string") fields.text = body.text;
    if (body.color !== undefined) fields.color = body.color === null ? null : String(body.color);
    await updateItem(params.itemId, fields);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/board-items/:itemId — 删除（owner/editor）。
export async function DELETE(_req: Request, { params }: { params: { itemId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const gate = await requireEdit(params.itemId, user.id);
    if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    await deleteItem(params.itemId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
