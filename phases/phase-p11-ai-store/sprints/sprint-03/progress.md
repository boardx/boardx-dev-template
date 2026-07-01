# 进度日志 — Sprint p11/03

## 当前已验证状态(唯一真相)
- 仓库根目录: .claude/worktrees/agent-aafef3b8c9ccffcf0（worktree）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`（当前在本机对 F04 无关，见下方 blocker）
- 当前最高优先级未完成功能: F04（项目喜欢/收藏状态展示与切换）— 实现已完成，feature 级 verification 全绿，
  等待 `pnpm harness verify` 门控（其 require_base_pass 依赖 `verify:base`，见 blocker）。
- 当前 blocker: `pnpm -w run verify:base` 在本 worktree 因共享机器上 `@rollup/rollup-darwin-arm64`
  可选依赖未安装（node_modules 里只有 x64 变体，pnpm store 本地缓存也没有 arm64 版本）而失败——
  影响所有用 vitest 的包（`@repo/data`/`@repo/storage`/`@repo/tools`/`@repo/auth`/`@repo/canvas` 等 `test` 任务），
  turbo 还会把失败级联标到下游 typecheck/build。与 F04 代码改动无关（已确认：单独跑
  `pnpm --filter @repo/data run typecheck`、`pnpm --filter @repo/web run typecheck`、`pnpm --filter @repo/web run lint`
  均干净通过）。这是环境问题，此前已有别的 worker 话在 `git stash list` 里留了同类记录
  （"unintended-side-effects: lint autofix + pnpm install(rollup dep/lock churn) — 待用户决定丢弃"）。
  按 coordinator 指示：不擅自 `pnpm add` 装依赖、不碰 lockfile、不 `--no-verify`，已停下等待协调方向。

## 会话记录
### 2026-07-01 19:03:14
- 本轮目标: 实现 F04（AI Store 项目喜欢/收藏状态展示与切换）
- 已完成:
  - `packages/data/migrations/018_ai_store_favorites.sql`：新增 `ai_store_favorites` 表（user_id, item_id 复合主键，同构于 board_favorites）。
  - `packages/data/src/aiStore.ts`：新增 `isAiStoreItemFavorited` / `listFavoritedAiStoreItemIds` / `toggleAiStoreFavorite`（切换喜欢并同步 `ai_store_items.likes` 聚合计数；不触碰 `updated_at`，避免扰动 Explore 列表排序）。
  - `apps/web/app/api/ai-store/items/[id]/favorite/route.ts`：新增 `POST` 切换接口（未登录 401，项目不存在/不可见 404）。
  - `apps/web/app/api/ai-store/items/route.ts` / `[id]/route.ts`：GET 响应附带 `liked` 字段（批量/单个）。
  - `apps/web/app/(app)/ai-store/store-browser.tsx`：卡片 + 详情弹窗心形按钮，乐观更新 + 失败回滚，二者状态互相同步；未登录场景走既有页面级 302 登录守卫（复用 F01 的 `/ai-store` server component 守卫）。
  - `apps/web/e2e/ai-store-004-favorite-item.spec.ts`：4 个用例（未登录 API 401、未登录页面重定向、卡片心形切换+刷新持久化、详情弹窗与卡片状态同步）。
- 运行过的验证:
  - `docker compose --env-file .env -f infra/docker-compose.yml up -d`（本 worktree 用 `.env` 里的 PG_PORT=61173/REDIS_PORT=61174/MINIO_PORT=62979/62980，避免和其它并行 worktree 的默认端口冲突；`COMPOSE_PROJECT_NAME` 已由 `init-worktree-env.sh` 写好）
  - `DATABASE_URL=postgresql://boardx:boardx@localhost:61173/boardx pnpm --filter @repo/data run migrate`（本 worktree 的 `migrate.ts` 版本不会自动加载 `.env`，需显式导出 `DATABASE_URL`）
  - `E2E_PORT=61175 DATABASE_URL=... pnpm --filter @repo/web exec playwright test e2e/ai-store-004-favorite-item.spec.ts` → 4/4 通过
  - `pnpm --filter @repo/web exec playwright test e2e/ai-store-001-browse-items.spec.ts`（F01 回归）→ 9/9 通过，无回归
  - `pnpm --filter @repo/data run typecheck`、`pnpm --filter @repo/web run typecheck`、`pnpm --filter @repo/web run lint` → 均通过
  - `pnpm -w run verify:base` → 因上述环境问题失败（与 F04 代码无关，见 blocker）
- 已记录证据: `phases/phase-p11-ai-store/sprints/sprint-03/evidence/f04-01-docker-up.txt`、`f04-02-migrate.txt`、
  `f04-03-e2e-favorite-final.txt`、`f04-04-typecheck-lint.txt`、`f04-05-e2e-f01-regression.txt`
- 提交记录: 分支 `worker/wrk-store-2-p11-f04-favorites`，PR 见 session-handoff.md
- 已知风险或未解决问题: `verify:base`/`verify:full` 在本机因 rollup 可选依赖安装问题受阻（环境问题，非本
  feature 代码问题），需要协调方决定是否/如何修复共享 node_modules 或调整门控。
- 下一步最佳动作: 等待 coordinator 对 verify:base blocker 的方向；F04 本身实现+feature 级验证已就绪，
  PR 已开，可在环境问题解决后由 `pnpm harness verify --sprint p11/03` 完成门控翻 passing。
