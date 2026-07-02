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

## 本轮改动
- `packages/data/migrations/018_ava_thread_share.sql`: 给 `ava_threads` 增加 share token/enabled/updated 字段与 token unique index。
- `packages/data/src/avaChat.ts`: 增加 share token 生成、启用/复用、关闭、公开读取仓储。
- `apps/web/app/api/ava/threads/[id]/share/route.ts`: owner-only GET/POST/DELETE 分享控制 API。
- `apps/web/app/api/chatShare/[id]/route.ts`: public read-only shared thread API，无效/关闭返回 403。
- `apps/web/app/chatShare/[id]/page.tsx`: public readonly share page，带 loading/invalid/unavailable/empty 状态，无输入框。
- `apps/web/app/(app)/ava/page.tsx`: 聊天头部分享入口、链接复制、关闭分享、邮箱禁用占位。
- `apps/web/e2e/ava-share-chat.spec.ts`: F04 e2e 契约。

## 仍损坏或未验证
- Docker daemon 不可用：`Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`
- 因 Docker 未启动，`pnpm --filter @repo/data run migrate` 提权后连接 DB `127.0.0.1:50398` 失败。
- 未跑通 `apps/web/e2e/ava-share-chat.spec.ts`，因为依赖 DB/migrate/dev server。
- 不要手改 `feature_list.json` 为 `passing`；当前 F04 保持 `in_progress` 是真实状态。

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
