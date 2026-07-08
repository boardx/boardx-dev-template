import { NextResponse } from "next/server";
import { getBoard, canManageBoard, createBackup, listBackups } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// p7:F08（uc-board-header-007）：白板备份。权限与错误码风格对齐 /api/boards/:id。

// GET /api/boards/:id/backups — 备份列表（仅管理者，否则 403）。
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const boardId = Number(params.id);
  const board = await getBoard(boardId);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await canManageBoard(boardId, user.id))) {
    return NextResponse.json({ error: "无管理权限" }, { status: 403 });
  }
  return NextResponse.json({ backups: await listBackups(boardId) });
}

// POST /api/boards/:id/backups — 创建备份（快照当前 items；仅管理者，否则 403）。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = Number(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canManageBoard(boardId, user.id))) {
      return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as { label?: unknown };
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ errors: { label: "备份名不能为空" } }, { status: 400 });
    }
    const backup = await createBackup(boardId, label, user.id);
    return NextResponse.json({ backup }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
