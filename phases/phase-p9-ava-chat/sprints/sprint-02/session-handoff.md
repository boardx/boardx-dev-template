# 会话交接 — Sprint p9/02

## 当前已验证
- F04 尚未 passing。实现已完成到可编译状态，但 harness verify 阻塞在 Docker daemon 未运行。
- 已通过的本地验证:
  - `pnpm --filter @repo/data run typecheck`
  - `pnpm --filter @repo/web run typecheck`
  - `pnpm --filter @repo/data run test`
  - `pnpm --filter @repo/web run lint`
  - `pnpm -w run verify:base`
- 未通过的门控验证:
  - `pnpm harness verify --sprint p9/02 --feature F04` failed at `docker compose -f infra/docker-compose.yml up -d`，证据见 `evidence/F04.verify.log`。
- F02（聊天线程列表 CRUD）此前已在隔离 worktree `/private/tmp/boardx-worktrees/issue-101-ava-f02` 落地并通过用户指定 verification，证据见 `phases/phase-p9-ava-chat/sprints/sprint-02/evidence/F02.verify.log`；F02 仍需 harness verify/status 门控推进为 `passing`，不要手改。

## 本轮改动（F04）
- `packages/data/migrations/018_ava_thread_share.sql`: 给 `ava_threads` 增加 share token/enabled/updated 字段与 token unique index。
- `packages/data/src/avaChat.ts`: 增加 share token 生成、启用/复用、关闭、公开读取仓储。
- `apps/web/app/api/ava/threads/[id]/share/route.ts`: owner-only GET/POST/DELETE 分享控制 API。
- `apps/web/app/api/chatShare/[id]/route.ts`: public read-only shared thread API，无效/关闭返回 403。
- `apps/web/app/chatShare/[id]/page.tsx`: public readonly share page，带 loading/invalid/unavailable/empty 状态，无输入框。
- `apps/web/app/(app)/ava/page.tsx`: 聊天头部分享入口、链接复制、关闭分享、邮箱禁用占位（与 F02 的线程分组/重命名/删除 UI 合并共存）。
- `apps/web/e2e/ava-share-chat.spec.ts`: F04 e2e 契约。

## F02 改动（此前已落地，随 main 合入本分支）
- `apps/web/app/(app)/ava/page.tsx`: 线程列表按日期分组、分页加载、选中态、重命名、删除、删除当前线程后进入空状态。
- `apps/web/app/api/ava/threads/route.ts`: 线程列表分页响应 `hasMore/nextCursor`。
- `apps/web/app/api/ava/threads/[id]/route.ts`: 当前 team/user 上下文校验，新增 PATCH rename 和 DELETE。
- `apps/web/app/api/ava/threads/[id]/messages/route.ts`: 发送消息前校验线程属于当前 team/user。
- `packages/data/src/avaChat.ts`: 线程分页查询、重命名、删除 helper。
- `apps/web/e2e/ava-threads.spec.ts`: F02 端到端覆盖。
- `scripts/init-worktree-env.sh`, `packages/data/src/migrate.ts`, `apps/web/playwright.config.ts`: 让隔离 worktree 的 compose/migrate/playwright 使用本 worktree env，避免复用共享端口或默认数据库。

## 仍损坏或未验证
- Docker daemon 不可用：`Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`
- 因 Docker 未启动，`pnpm --filter @repo/data run migrate` 提权后连接 DB `127.0.0.1:50398` 失败。
- 未跑通 `apps/web/e2e/ava-share-chat.spec.ts`，因为依赖 DB/migrate/dev server。
- 不要手改 `feature_list.json` 为 `passing`；当前 F04 保持 `in_progress` 是真实状态，F02 同样保持 `in_progress`。

## 下一步最佳动作
- 启动 Docker daemon。
- 在本 worktree 运行:
  1. `docker compose -f infra/docker-compose.yml up -d`
  2. `pnpm --filter @repo/data run migrate`
  3. `pnpm --filter @repo/web exec playwright test e2e/ava-share-chat.spec.ts`
  4. `pnpm harness verify --sprint p9/02 --feature F04`
- 只继续 F04；不要改其他 worktree，不要碰 F02/F03/F06/F07/F10 的实现。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p9/02`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/ava-share-chat.spec.ts --debug`
