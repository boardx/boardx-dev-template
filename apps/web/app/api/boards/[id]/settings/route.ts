import { NextResponse } from "next/server";
import { canManageBoard, getBoard, resolveBoardId, updateBoardSettings } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KEYS = ["grid", "snap"] as const;

// PATCH /api/boards/:id/settings — 更新白板设置/交互偏好（管理者，否则 403）。
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = await resolveBoardId(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canManageBoard(boardId, user.id))) {
      return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, boolean> = {};
    for (const k of ALLOWED_KEYS) {
      if (k in body) patch[k] = Boolean(body[k]);
    }
    const updated = await updateBoardSettings(boardId, patch);
    return NextResponse.json({ board: updated, settings: updated?.settings ?? {} });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
