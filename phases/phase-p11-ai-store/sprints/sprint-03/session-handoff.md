# 会话交接 — Sprint p11/03

## 当前已验证（本轮，wrk-store-2 重新派发，2026-07-02）
- F04（项目喜欢/收藏状态展示与切换）：仍是 `in_progress`（未门控为 passing，等待协调者/`pnpm harness verify`）。
- 背景：上一轮派发（另一 worktree `agent-aafef3b8c9ccffcf0`）已完整实现 F04，但因 `verify:full` 全量 e2e
  遭遇共享主机资源争用（与 F04 无关的 83 个失败）而停在半路，从未 push/开 PR。本轮 wrk-store-2 重新认领后，
  确认协调者已改为**轻量门控**（只需 F04 feature-level verification + `verify:base`，不要求 `verify:full`），
  于是把上一轮的产出（commit `731048a` + `215f313`）cherry-pick 到当前 worktree 的新分支，解决与期间已
  合并的 F02（create/update）的合并冲突，重新走完整验证。
- 本轮 feature 级 verification（feature_list.json 里 F04 的三条命令）：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/ai-store-004-favorite-item.spec.ts` → **4/4 通过**
- 额外跑的回归：`ai-store-001-browse-items.spec.ts` + `ai-store-002-create-update-item.spec.ts`（F01+F02）
  → **10/10 通过，零回归**。
- `pnpm --filter @repo/data run typecheck`、`pnpm --filter @repo/web run typecheck`、
  `pnpm --filter @repo/web run lint` → 均通过。
- `pnpm -w run verify:base` → **45/45 successful**（协调者确认本轮不要求 `verify:full`）。

## 本轮改动（相对 main / origin HEAD）
- `packages/data/migrations/018_ai_store_favorites.sql`（新表 `ai_store_favorites`：user_id+item_id 复合主键，同构于 `board_favorites`）
- `packages/data/src/aiStore.ts`（+`isAiStoreItemFavorited`/`listFavoritedAiStoreItemIds`/`toggleAiStoreFavorite`，只追加不改已有函数）
- `apps/web/app/api/ai-store/items/[id]/favorite/route.ts`（新，POST 切换：未登录 401，不可见/不存在 404）
- `apps/web/app/api/ai-store/items/route.ts`、`.../[id]/route.ts`（GET 响应附带 `liked` 字段；与 F02 的
  `getMembership`/`createAiStoreItem`/`updateAiStoreItem`/`owner=me` 分支共存，import 合并冲突已手工解决，
  未改 F02 业务逻辑）
- `apps/web/app/(app)/ai-store/store-browser.tsx`（卡片+详情弹窗心形按钮，乐观更新+失败回滚，二者状态互相
  同步；与 F02 的 `Pencil` 编辑入口共存）
- `apps/web/e2e/ai-store-004-favorite-item.spec.ts`（新，4 个用例）
- `phases/phase-p11-ai-store/sprints/sprint-03/evidence/f04-wrk2-*.txt`（本轮独立证据）

## 仍未做 / 明确排除
- 未跑 `verify:full`（协调者已确认的轻量门控范围，理由：上一轮已记录全量 e2e 在共享主机上有 83 个与
  F04 无关的失败，属主机资源争用噪音，非回归）。
- 未碰任何 F02（create/update，codex 分支）范围内的业务文件；仅在两个 route.ts 的 import 语句处合并冲突。
- 未手动改 `feature_list.json`/`active-features.json` 状态；未自行合并 PR。

## 下一步最佳动作
- push 分支 `worker/wrk-store-2-p11-f04-favorites` 到 origin，开 PR（base=main，正文含 `Closes #118`，
  如实说明跳过 `verify:full` 的原因 + 本轮 targeted 证据路径）。
- `gh issue edit 118 --add-label status:in-review --remove-label status:in-progress`。
- 等待人工/协调者 review，由 `pnpm harness verify --sprint p11/03` 门控转 passing；本 agent 不自行合并、
  不自行标 passing。

## 命令
- 启动：`pnpm -w run dev`
- 验证：`pnpm harness verify --sprint p11/03`
- 本地调试（当前 worktree 独立端口，见 `.env` / `apps/web/.env.local`，由 `scripts/init-worktree-env.sh` 生成）：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/ai-store-004-favorite-item.spec.ts`
