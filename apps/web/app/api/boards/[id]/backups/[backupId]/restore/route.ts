import { NextResponse } from "next/server";
import { canManageBoard, getBackup, getBoard, resolveBoardId, restoreBackup } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/boards/:id/backups/:backupId/restore — 从备份恢复白板内容（p7:F08）。
// 仅管理者；备份必须属于该 board（否则 404）。恢复在数据层事务内完成，
// 失败自动 ROLLBACK，白板保持原状态（uc-board-header-007 异常流程 2）。
export async function POST(
  _req: Request,
  { params }: { params: { id: string; backupId: string } }
) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = await resolveBoardId(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canManageBoard(boardId, user.id))) {
      return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    }
    const backupId = Number(params.backupId);
    const backup = await getBackup(backupId);
    // pg 的 bigint 列以 string 返回，统一 Number 后比较（否则恒不相等 → 恒 404）
    if (!backup || Number(backup.board_id) !== boardId) {
      return NextResponse.json({ error: "备份不存在" }, { status: 404 });
    }
    const restored = await restoreBackup(boardId, backupId);
    return NextResponse.json({ ok: true, restored });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
