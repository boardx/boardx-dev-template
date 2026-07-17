import { NextResponse } from "next/server";
import { getItem, getBoardAccessRole, updateItem, deleteItem } from "@repo/data";
import { isColorSafe } from "@repo/canvas";
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
    if (body.color !== undefined) {
      const color = body.color === null ? null : String(body.color);
      // p7:F12 stored XSS 防护：链接哨兵（color 头 "link"）的 URL 必须是 http/https。
      // 无鉴别地放行 color 会让攻击者写入 `javascript:`/`data:` URL，其它用户点击「打开
      // 链接」时在其会话执行脚本。只对链接哨兵校验，其它 color 值（便签色/文本/形状/连接线/
      // 锁定/z 等哨兵）不受影响（isColorSafe 对非链接哨兵一律返回 true）。
      if (!isColorSafe(color)) {
        return NextResponse.json({ error: "链接协议不允许（仅支持 http/https）" }, { status: 400 });
      }
      fields.color = color;
    }
    await updateItem(params.itemId, fields);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
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
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
