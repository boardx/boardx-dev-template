# 会话交接 — Sprint p11/03

## 当前已验证
- F04（项目喜欢/收藏状态展示与切换）：仍是 `in_progress`（未门控为 passing，见下）。
  feature 级 verification 三条命令均已跑绿：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/ai-store-004-favorite-item.spec.ts`（4/4 通过）
  另外跑了 F01 回归（`ai-store-001-browse-items.spec.ts`，9/9 通过，无回归）与
  `@repo/data`/`@repo/web` 的 typecheck + web lint（均通过）。

## 本轮改动
- `packages/data/migrations/018_ai_store_favorites.sql`（新表 `ai_store_favorites`）
- `packages/data/src/aiStore.ts`（+`isAiStoreItemFavorited`/`listFavoritedAiStoreItemIds`/`toggleAiStoreFavorite`）
- `apps/web/app/api/ai-store/items/[id]/favorite/route.ts`（新，POST 切换）
- `apps/web/app/api/ai-store/items/route.ts`、`.../[id]/route.ts`（GET 附带 `liked`）
- `apps/web/app/(app)/ai-store/store-browser.tsx`（卡片+详情弹窗心形按钮，乐观更新+回滚）
- `apps/web/e2e/ai-store-004-favorite-item.spec.ts`（新）
- 未改动 F02（create/update）相关文件；`packages/data/src/aiStore.ts` 只在文件末尾追加，未碰 F01 已有函数。

## 仍损坏或未验证
- `pnpm -w run verify:base`（= `turbo run typecheck lint test`）在本 worktree 因共享机器上
  `@rollup/rollup-darwin-arm64` 可选依赖缺失而失败，牵连 `@repo/data`/`@repo/storage`/`@repo/tools`/
  `@repo/auth`/`@repo/canvas` 等所有用 vitest 的包的 `test` 任务（进而被 turbo 级联标到下游
  typecheck/build）。已确认与 F04 代码无关：单独跑 `@repo/data`/`@repo/web` 的 typecheck 和
  `@repo/web` 的 lint 都是干净的。`pnpm harness verify` 会因 `require_base_pass: true` 卡在这里，
  所以 F04 目前**没有**被门控翻 `passing`，仍是 `in_progress`（按规则不能自己改状态）。
  `git stash list` 里已有另一个 worker 留的同类记录（rollup/lockfile churn，待用户决定丢弃），
  说明这是本机环境的既存问题，不是我这轮引入的。
- 按 coordinator 指示没有擅自 `pnpm add` 装 `@rollup/rollup-darwin-arm64`、没有碰 `pnpm-lock.yaml`、
  没有对 pre-push hook 用 `--no-verify`。

## 下一步最佳动作
- coordinator 决定如何处理 `verify:base` 的 rollup 环境问题后（例如统一在机器上补齐 arm64 可选依赖、
  或调整 harness 门控对该已知问题的处理方式），重跑 `pnpm harness verify --sprint p11/03` 应该就能让
  F04 门控翻 passing（feature 级验证已确认全绿）。
- 下一轮不要重新触碰 F02（create/update，codex 在做）相关文件；`packages/data/src/aiStore.ts` 里
  F02 需要的函数（`createAiStoreItem`/`updateAiStoreItem`/`icon` 字段等）在我这个 worktree 的分支基线里
  还不存在，是在其他分支上，合并时注意可能的合并冲突（我只在文件末尾追加了 favorite 相关函数）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p11/03`
- 调试（本 worktree 专用端口，见 `.env` / `apps/web/.env.local`）:
  - `docker compose --env-file .env -f infra/docker-compose.yml up -d`
  - `DATABASE_URL=postgresql://boardx:boardx@localhost:61173/boardx pnpm --filter @repo/data run migrate`
  - `E2E_PORT=61175 DATABASE_URL=postgresql://boardx:boardx@localhost:61173/boardx pnpm --filter @repo/web exec playwright test e2e/ai-store-004-favorite-item.spec.ts`
