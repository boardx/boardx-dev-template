# 进度日志 — Sprint p11/03

## 当前已验证状态(唯一真相)
- 仓库根目录: .claude/worktrees/agent-aafef3b8c9ccffcf0（worktree）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`（**已修复，见下**）；`verify:full` 里的全量 e2e 仍受阻（见 blocker）。
- 当前最高优先级未完成功能: F04（项目喜欢/收藏状态展示与切换）— 实现已完成，feature 级 verification 全绿
  （含在全量 e2e 套件里跑时也全绿），等待 `pnpm harness verify` 门控。
- rollup 问题已解决: 最初 `verify:base` 因本 worktree `node_modules` 里 `@rollup/rollup-darwin-arm64`
  缺失（只装了 x64 变体）而失败。按 coordinator 指示跑 `corepack pnpm@9.0.0 install`（而非裸 `pnpm install`，
  后者会解析到 PATH 上的 pnpm8）后问题解决：`git status` 对 `pnpm-lock.yaml`/`package.json` 无改动（无需
  revert），重跑 `pnpm -w run verify:base` → **45/45 全绿**；`pnpm --filter @repo/web run build`（生产构建）
  也成功。
- 当前 blocker（新的，和 rollup 无关）: `pnpm -w run verify:full` 的第 3 步「起 docker + migrate + 全量
  Playwright e2e」在本机跑了 27 分钟、300+ 用例，结果 219 passed / 83 failed。**失败全部分布在与 F04
  无关的功能**（team/room 管理、board 权限、canvas、widgets、collab、survey、kb 等），ai-store 相关的两个
  spec（`ai-store-001-browse-items.spec.ts` 9/9、`ai-store-004-favorite-item.spec.ts` 4/4）在这次全量跑里
  **全部通过，零回归**。日志里有 42 处 `Connection terminated unexpectedly` / `database system is in
  recovery mode`（postgres 在长时间单 worker 串行跑 300+ 用例、且同机还有其它 worktree 的 docker 栈在跑的
  情况下连接不稳定），失败模式（大范围、跨多个不相关功能域、伴随大量 DB 连接错误）符合共享主机资源争用，
  不是 F04 改动引入的回归。按 coordinator 指示：这种情况停下报告，不擅自 `--no-verify`。
  另外，本轮验证 3 次尝试期间还发现并处理了两个纯环境层小问题（皆未進代码改动）：
  (a) `verify-full.sh` 自己起的 docker compose（project name `infra`）会和我手动起的
  `worktree-agent-aafef3b8c9ccffcf0-*` 容器抢 61173/61174 端口——起 verify:full 前需要先
  `docker compose -f infra/docker-compose.yml down` 清掉自己手动起的那套；
  (b) `verify-full.sh` 没有导出 `MINIO_PORT`/`MINIO_CONSOLE_PORT`，minio 默认 9090/9091 会和同机其它 worktree
  的 minio 撞——本轮通过临时 `env MINIO_PORT=... MINIO_CONSOLE_PORT=...` 传参绕过，未改脚本本身。

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
  - `corepack pnpm@9.0.0 install`（修复 rollup 可选依赖，按 coordinator 指示；`pnpm-lock.yaml`/`package.json`
    均无 diff，无需 revert）→ 之后 `pnpm -w run verify:base` → **45/45 全绿**
  - `pnpm --filter @repo/web run build`（生产构建，verify:full 第 2 步）→ 成功
  - `pnpm -w run verify:full`（含第 3 步全量 e2e，300+ 用例，27 分钟）→ 219 passed / 83 failed；
    **ai-store 相关 13 个用例（F01 的 9 个 + F04 的 4 个）全部通过**；失败均分布在无关功能域
    （team/room/board 权限、canvas、widgets、collab、survey、kb），且日志里有 42 处
    `Connection terminated unexpectedly` / `database system is in recovery mode`，指向共享主机长时间
    高负载下的 DB 连接不稳定，不是 F04 引入的回归。
- 已记录证据: `phases/phase-p11-ai-store/sprints/sprint-03/evidence/f04-01-docker-up.txt`、`f04-02-migrate.txt`、
  `f04-03-e2e-favorite-final.txt`、`f04-04-typecheck-lint.txt`、`f04-05-e2e-f01-regression.txt`、
  `f04-06-verify-base-clean.txt`（rollup 修复后 45/45）、`f04-07-verify-full-e2e-summary.txt`（全量 e2e 统计
  + ai-store 逐条结果摘录）、`f04-08-verify-full-e2e-all-results.txt`（全量 e2e 300+ 用例逐条 pass/fail 列表）
- 提交记录: 分支 `worker/wrk-store-2-p11-f04-favorites`，commit `731048a`；尚未 push（见下方 blocker），
  未开 PR（PR 需 push 成功后才能开）。
- 已知风险或未解决问题: `verify:full` 的全量 e2e 步骤在本机因共享主机资源争用/DB 连接不稳定，跑出 83 个
  与 F04 无关的失败，pre-push hook（镜像 CI）据此中止了 push。rollup 环境问题已经 coordinator 指导的
  `corepack pnpm@9.0.0 install` 解决，`verify:base` 和生产 build 都已确认干净。
- 下一步最佳动作: 等待 coordinator 对「全量 e2e 因主机资源争用零星失败、但与 F04 无关」这一情况的处理方向
  （例如是否有已知的 e2e 全量套件基线失败清单可比对、是否需要换个负载较低的时间窗口重跑、或是否有其它
  绕过全量 e2e 门禁但不牺牲信心的办法）。F04 本身实现 + feature 级 verification（含在全量套件里跑）已确认
  全绿，随时可在拿到方向后完成 push + 开 PR。
