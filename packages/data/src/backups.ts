// packages/data/src/backups.ts — CAP-DATA 白板备份仓储（board_backups / p7 F08，uc-board-header-007）
// 备份 = 创建时刻该 board 全量 items 的 jsonb 快照；恢复 = 事务内删旧插新（保留原 item id）。
import { getPool, query } from "./index";
import type { BoardItemRow } from "./items";

export interface BoardBackupRow {
  // 注意：pg 把 bigint 列以 string 返回（与本库其他 bigint id 一致），比较前先 Number()。
  id: number | string;
  board_id: number | string;
  label: string;
  created_by: number | string;
  created_at: string;
}

export interface BoardBackupWithSnapshot extends BoardBackupRow {
  snapshot: BoardItemRow[];
}

const BACKUP_COLS = "id, board_id, label, created_by, created_at";

/** 创建备份：读取当前 board 全量 items 存为 jsonb 快照。 */
export async function createBackup(
  boardId: number,
  label: string,
  createdBy: number
): Promise<BoardBackupRow> {
  const items = await query<BoardItemRow>(
    `SELECT id, room_id, board_id, type, x, y, w, h, text, color
     FROM board_items WHERE board_id = $1 ORDER BY created_at`,
    [boardId]
  );
  const rows = await query<BoardBackupRow>(
    `INSERT INTO board_backups (board_id, label, snapshot, created_by)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING ${BACKUP_COLS}`,
    [boardId, label, JSON.stringify(items), createdBy]
  );
  return rows[0]!;
}

/** 备份列表（不含快照体，避免大 payload），新的在前。 */
export async function listBackups(boardId: number): Promise<BoardBackupRow[]> {
  return query<BoardBackupRow>(
    `SELECT ${BACKUP_COLS} FROM board_backups WHERE board_id = $1 ORDER BY created_at DESC, id DESC`,
    [boardId]
  );
}

/** 单条备份（含快照体）。 */
export async function getBackup(backupId: number): Promise<BoardBackupWithSnapshot | undefined> {
  const rows = await query<BoardBackupWithSnapshot>(
    `SELECT ${BACKUP_COLS}, snapshot FROM board_backups WHERE id = $1`,
    [backupId]
  );
  return rows[0];
}

/**
 * 从备份恢复：事务内先删该 board 全部 items，再逐条插回快照内容（保留原 item id）。
 * 任一步失败即 ROLLBACK，白板保持恢复前状态（uc-board-header-007 异常流程 2）。
 * 返回恢复后的 item 数。
 */
export async function restoreBackup(boardId: number, backupId: number): Promise<number> {
  const backup = await getBackup(backupId);
  if (!backup || Number(backup.board_id) !== Number(boardId)) {
    throw new Error("backup not found for board");
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM board_items WHERE board_id = $1", [boardId]);
    for (const item of backup.snapshot) {
      await client.query(
        `INSERT INTO board_items (id, room_id, board_id, type, x, y, w, h, text, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.id,
          item.room_id,
          boardId,
          item.type,
          item.x,
          item.y,
          item.w,
          item.h,
          item.text,
          item.color ?? null,
        ]
      );
    }
    await client.query("COMMIT");
    return backup.snapshot.length;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
