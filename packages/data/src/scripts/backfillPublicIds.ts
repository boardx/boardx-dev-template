// packages/data/src/scripts/backfillPublicIds.ts — 幂等回填 boards/rooms 的 public_id
//（issue #471 阶段 1）。用法：pnpm --filter @repo/data run backfill:public-id
//
// 幂等设计：
// - 只处理 public_id IS NULL 的行（已回填的行天然跳过，可安全重跑任意次）。
// - 按主键 id 匹配 UPDATE（不是按 name 等自然键——见事故分诊速查 PR #312 先例：
//   自然键在并发/重名场景下会互相踩踏，主键是唯一安全的匹配锚点）。
// - id 生成撞到 UNIQUE 约束冲突（概率极低，见 ids.ts 注释）时重试，不静默跳过、
//   不让该行永久停留在 NULL。
import { generateId } from "../ids";
import { closePool, getPool } from "../index";

const MAX_RETRIES = 5;

async function backfillTable(table: "boards" | "rooms", prefix: string): Promise<number> {
  const pool = getPool();
  const rows = await pool.query<{ id: string }>(`SELECT id FROM ${table} WHERE public_id IS NULL ORDER BY id`);
  let filled = 0;
  for (const row of rows.rows) {
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        await pool.query(`UPDATE ${table} SET public_id = $1 WHERE id = $2 AND public_id IS NULL`, [
          generateId(prefix),
          row.id,
        ]);
        filled += 1;
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        // 唯一约束冲突（23505）→ 换一个新生成的 id 重试；其它错误直接抛出，不吞。
        const code = (err as { code?: string } | null)?.code;
        if (code !== "23505") throw err;
      }
    }
    if (lastErr) throw lastErr;
  }
  return filled;
}

async function run(): Promise<void> {
  const boardsFilled = await backfillTable("boards", "brd");
  console.log(`✓ boards：回填 ${boardsFilled} 行`);
  const roomsFilled = await backfillTable("rooms", "rm");
  console.log(`✓ rooms：回填 ${roomsFilled} 行`);
  console.log("回填完成（幂等，可安全重跑确认无遗漏）。");
}

run()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("回填失败：", err);
    await closePool();
    process.exit(1);
  });
