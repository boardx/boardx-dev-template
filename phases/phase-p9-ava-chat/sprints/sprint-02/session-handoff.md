# 会话交接 — Sprint p9/02

## 当前已验证
- F10 / 建议动作（快捷问题填入输入框）已由 harness 门控升级为 `passing`。
- F10 验证命令:
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/ava-suggested-actions.spec.ts`
  - `pnpm harness verify --sprint p9/02 --feature F10`（包含 `pnpm -w run verify:base`）
- F10 证据: `phases/phase-p9-ava-chat/sprints/sprint-02/evidence/F10.verify.log`
- F03「编辑/删除消息 + 重新生成后续回复」已由 harness 升级为 `passing`。
- F03 验证命令: `pnpm harness verify --sprint p9/02 --feature F03`。
- F03 证据: `phases/phase-p9-ava-chat/sprints/sprint-02/evidence/F03.verify.log`。
- F02 聊天线程列表 CRUD 已在隔离 worktree `/private/tmp/boardx-worktrees/issue-101-ava-f02` 落地并通过用户指定 verification（并入 main）。
- F02 验证证据: `phases/phase-p9-ava-chat/sprints/sprint-02/evidence/F02.verify.log`
- F04（本 resync 前）尚未 passing。实现已完成到可编译状态，但 harness verify 阻塞在 Docker daemon 未运行。
  - 已通过的本地验证:
    - `pnpm --filter @repo/data run typecheck`
    - `pnpm --filter @repo/web run typecheck`
    - `pnpm --filter @repo/data run test`
    - `pnpm --filter @repo/web run lint`
    - `pnpm -w run verify:base`
  - 未通过的门控验证:
    - `pnpm harness verify --sprint p9/02 --feature F04` failed at `docker compose -f infra/docker-compose.yml up -d`，证据见 `evidence/F04.verify.log`。

## 本轮改动（F10）
- `apps/web/app/(app)/ava/page.tsx`: 抽出建议动作数据和渲染组件；空态展示内置建议；最后一条完整 assistant 回复下方展示下一步建议；点击建议填入 composer 并聚焦，用户可继续编辑再发送；发送中、最后消息非完整 assistant、失败回复等无建议场景隐藏建议区。
- `apps/web/e2e/ava-suggested-actions.spec.ts`: 覆盖空态建议填入、编辑后普通发送、回复下方建议刷新、失败回复无建议隐藏。
- `phases/phase-p9-ava-chat/feature_list.json`: F10 经 harness verify 更新为 `passing` 并写入 evidence。

## 本轮改动（F04，此前由 wrk-codex-ava-3 落地并随 main 合入）
- `packages/data/migrations/018_ava_thread_share.sql`: 给 `ava_threads` 增加 share token/enabled/updated 字段与 token unique index。
- `packages/data/src/avaChat.ts`: 增加 share token 生成、启用/复用、关闭、公开读取仓储。
- `apps/web/app/api/ava/threads/[id]/share/route.ts`: owner-only GET/POST/DELETE 分享控制 API。
- `apps/web/app/api/chatShare/[id]/route.ts`: public read-only shared thread API，无效/关闭返回 403。
- `apps/web/app/chatShare/[id]/page.tsx`: public readonly share page，带 loading/invalid/unavailable/empty 状态，无输入框。
- `apps/web/app/(app)/ava/page.tsx`: 聊天头部分享入口、链接复制、关闭分享、邮箱禁用占位（与 F02/F03/F10 的线程分组/重命名/删除/编辑消息/建议动作 UI 合并共存）。
- `apps/web/e2e/ava-share-chat.spec.ts`: F04 e2e 契约。

## 此前改动（F03，已并入 main）
- `apps/web/app/(app)/ava/page.tsx`: 增加最后用户消息编辑/删除 UI、确认删除、失败态展示和 SSE 更新处理。
- `apps/web/app/api/ava/threads/[id]/messages/[messageId]/route.ts`: 增加 PATCH/DELETE 接口，只允许编辑/删除最后一条用户消息。
- `apps/web/app/api/ava/threads/[id]/messages/reply-stream.ts`: 抽出 AVA SSE 回复生成逻辑，支持 updated/token/done/error 事件。
- `packages/data/src/avaChat.ts`: 增加编辑/删除最后用户消息并清理后续回复的事务方法。
- `apps/web/e2e/ava-edit-delete-message.spec.ts`: 覆盖编辑重生成、取消、空内容校验、删除确认和失败保留用户消息。
- Worktree 本地环境使用独立端口，避免和其他 agent worktree 复用服务。

## F02 改动（此前已落地，随 main 合入本分支）
- `apps/web/app/(app)/ava/page.tsx`: 线程列表按日期分组、分页加载、选中态、重命名、删除、删除当前线程后进入空状态。
- `apps/web/app/api/ava/threads/route.ts`: 线程列表分页响应 `hasMore/nextCursor`。
- `apps/web/app/api/ava/threads/[id]/route.ts`: 当前 team/user 上下文校验，新增 PATCH rename 和 DELETE。
- `apps/web/app/api/ava/threads/[id]/messages/route.ts`: 发送消息前校验线程属于当前 team/user。
- `packages/data/src/avaChat.ts`: 线程分页查询、重命名、删除 helper。
- `apps/web/e2e/ava-threads.spec.ts`: F02 端到端覆盖。
- `scripts/init-worktree-env.sh`, `packages/data/src/migrate.ts`, `apps/web/playwright.config.ts`: 让隔离 worktree 的 compose/migrate/playwright 使用本 worktree env，避免复用共享端口或默认数据库。

## 仍损坏或未验证
- 无 F10/F03 阻塞。第一次正式 verify 的基础验证曾被 `@repo/auth` 密码 hash 单测 5s 超时拦住；停止临时 dev server 后重跑同一命令已通过。
- F10 的 Agent 预设建议问题仍依赖 p11 AI Store Agent 创建器配置，本轮按 feature notes 仅实现通用内置建议。
- p9/02 仍有其他 feature 未完成；当前 active view 中 F02 属于 owner `wrk-codex-1`，不要在本 worktree 中接手或覆盖。
- F04：Docker daemon 此前不可用：`Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`
  - 因 Docker 未启动，`pnpm --filter @repo/data run migrate` 提权后连接 DB `127.0.0.1:50398` 失败。
  - 未跑通 `apps/web/e2e/ava-share-chat.spec.ts`，因为依赖 DB/migrate/dev server；本轮 resync 后需重新起 infra 验证。
  - 不要手改 `feature_list.json` 为 `passing`；当前 F04 保持 `in_progress` 是真实状态。

## 下一步最佳动作
- 继续 p9/02 未完成 feature（F04/F06/F07 或协调 F02 owner 进展），保持一次只做一个 owner scope 内的 `in_progress`。
- F04 具体步骤：
  1. 启动 Docker daemon。
  2. `docker compose -f infra/docker-compose.yml up -d`
  3. `pnpm --filter @repo/data run migrate`
  4. `pnpm --filter @repo/web exec playwright test e2e/ava-share-chat.spec.ts`
  5. `pnpm harness verify --sprint p9/02 --feature F04`
  - 只继续 F04；不要改其他 worktree，不要碰 F02/F03/F06/F07/F10 的实现。
- 不要手改 `active-features.json`；不要手动把 feature 标为 `passing`。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p9/02`
- 调试:
  - `pnpm --filter @repo/web exec tsc --noEmit`
  - `pnpm --filter @repo/web run lint`
  - `pnpm --filter @repo/web exec playwright test e2e/ava-suggested-actions.spec.ts`
  - `pnpm --filter @repo/web exec playwright test e2e/ava-edit-delete-message.spec.ts`
  - `pnpm --filter @repo/web exec playwright test e2e/ava-share-chat.spec.ts --debug`
