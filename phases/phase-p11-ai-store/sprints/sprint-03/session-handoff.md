# 会话交接 — Sprint p11/03

## 当前已验证
- F04（项目喜欢/收藏状态展示与切换）：仍是 `in_progress`（未门控为 passing，见下）。
  feature 级 verification 三条命令均已跑绿：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/ai-store-004-favorite-item.spec.ts`（4/4 通过）
  另外跑了 F01 回归（`ai-store-001-browse-items.spec.ts`，9/9 通过，无回归）与
  `@repo/data`/`@repo/web` 的 typecheck + web lint（均通过）。
  之后按 coordinator 指示修复 rollup 环境问题（见下）后，`pnpm -w run verify:base` 45/45 全绿，
  `pnpm --filter @repo/web run build` 生产构建成功；`verify:full` 全量 e2e（300+ 用例）里
  ai-store 的 13 个用例（F01 9 个 + F04 4 个）全部通过，无回归。

## 本轮改动
- `packages/data/migrations/018_ai_store_favorites.sql`（新表 `ai_store_favorites`）
- `packages/data/src/aiStore.ts`（+`isAiStoreItemFavorited`/`listFavoritedAiStoreItemIds`/`toggleAiStoreFavorite`）
- `apps/web/app/api/ai-store/items/[id]/favorite/route.ts`（新，POST 切换）
- `apps/web/app/api/ai-store/items/route.ts`、`.../[id]/route.ts`（GET 附带 `liked`）
- `apps/web/app/(app)/ai-store/store-browser.tsx`（卡片+详情弹窗心形按钮，乐观更新+回滚）
- `apps/web/e2e/ai-store-004-favorite-item.spec.ts`（新）
- 未改动 F02（create/update）相关文件；`packages/data/src/aiStore.ts` 只在文件末尾追加，未碰 F01 已有函数。

## 仍损坏或未验证
- **rollup 问题已解决**：最初 `pnpm -w run verify:base` 因本 worktree `node_modules` 里
  `@rollup/rollup-darwin-arm64` 缺失（只装了 x64 变体，是裸 `pnpm install` 解析到 PATH 上 pnpm8 导致的
  已知问题）而失败。coordinator 指示跑 `corepack pnpm@9.0.0 install`（不是裸 `pnpm install`）后修复，
  `git status` 对 `pnpm-lock.yaml`/`package.json` 均无 diff（无需 revert），重跑 `verify:base` → 45/45，
  `@repo/web` 生产 build 也成功。
- **新发现的、和 F04 无关的 blocker**：`pnpm -w run verify:full` 第 3 步的全量 Playwright e2e（300+ 用例，
  串行跑了 27 分钟）里，219 passed / 83 failed。失败**全部**分布在其它功能域（team/room 管理、board 权限、
  canvas、widgets、collab、survey、kb 等），ai-store 的 13 个用例（F01 的 9 个 + F04 的 4 个）**全部通过**，
  零回归。日志里有 42 处 `Connection terminated unexpectedly` / `database system is in recovery mode`，
  指向本机长时间高负载下 postgres 连接不稳定（同机还有其它 worktree 在跑各自的 docker 栈），符合共享主机
  资源争用的特征，不像是某个具体 feature 的代码 bug。pre-push hook 据此中止了 push。
- 过程中还发现两个纯环境层小问题（未改代码）：`verify-full.sh` 自己起的 docker compose（project name
  `infra`）会和我手动起的 `worktree-agent-aafef3b8c9ccffcf0-*` 容器抢 61173/61174 端口（跑 verify:full 前
  要先 `docker compose -f infra/docker-compose.yml down` 清掉手动起的那套）；`verify-full.sh` 没有导出
  `MINIO_PORT`/`MINIO_CONSOLE_PORT`，默认 9090/9091 会跟同机其它 worktree 的 minio 撞（本轮用临时
  `env MINIO_PORT=... MINIO_CONSOLE_PORT=...` 绕过，未改脚本）。
- 按 coordinator 指示没有对 pre-push hook 用 `--no-verify`；push 尚未成功，PR 尚未开。

## 下一步最佳动作
- 等 coordinator 对「全量 e2e 因共享主机资源争用零星失败、但与 F04 无关」这一新情况给方向（例如是否有
  已知基线失败清单可比对确认这些失败是既存的、是否换个负载更低的时间段重跑会更干净、或是否有其它不牺牲
  信心的绕过方式）。F04 本身实现完整、feature 级验证（含在全量套件里跑）已确认全绿，方向明确后可以立刻
  完成 push + 开 PR（`Closes #118`）。
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
