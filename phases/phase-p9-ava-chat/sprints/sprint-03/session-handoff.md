# 会话交接 — Sprint p9/03

## 当前已验证
- F08（向聊天附加文件/图片/音频）：`pnpm harness verify --sprint p9/03` 已通过，状态为
  `passing`（见 `phases/phase-p9-ava-chat/feature_list.json`）。验证命令
  `pnpm --filter @repo/web exec playwright test e2e/ava-attach-files.spec.ts` 8/8 通过，
  `require_base_pass` 触发的 `pnpm -w run verify:base` 45/45 successful。证据见
  `evidence/F08.verify.log`（harness 产出，覆盖了早前一次因本机资源争用产生的失败日志）。
- 另跑过的回归确认（未写进 verification，但确认未破坏既有行为）：
  `e2e/ava-chat-basic.spec.ts`（F01，5/5）、`e2e/kb-001-upload-file.spec.ts`（p10 KB 上传，
  需先起 `workflow-worker`，5/5）。

## 本轮改动
- 新表 + 仓储：`packages/data/migrations/018_ava_message_attachments.sql`、
  `packages/data/src/avaChat.ts` 新增附件 CRUD（暂存态 `message_id IS NULL` → 发消息时回填关联）。
- `packages/storage/src/index.ts`：新增 AVA 专用的上传校验/对象 key 规则（与 KB 的规则并存、
  独立前缀 `ava/...`），复用既有 S3/MinIO 客户端层，未改动 KB 原有的
  `validateKbUpload`/`buildKbObjectKey`/`putObject` 等导出。
- 新 API 路由：
  - `POST/DELETE /api/ava/threads/[id]/attachments[/[attachmentId]]`
  - `GET /api/ava/attachments/[attachmentId]/url`
  - `POST /api/ava/threads/[id]/messages` 扩展：接受 `attachmentIds`，关联到新消息，并把附件
    文件名拼进传给 LLM 网关的上下文（`packages/ai/src/gateway.ts` 的 `buildStubReply` 相应更新，
    使 stub 回复引用附件文件名）。
- 前端：新文件 `apps/web/app/(app)/ava/attachments.tsx`（`useAvaAttachments` hook +
  `AttachmentTrigger`/`AttachmentPreviewStrip` 组件），接入
  `apps/web/app/(app)/ava/page.tsx`（拖拽区、消息气泡内展示附件、发送按钮在上传中禁用）。
- 安全修复（#153，同一文件territory顺手做）：`apps/web/app/api/ava/threads/[id]/route.ts`、
  `.../messages/route.ts` 的鉴权从只查 `thread.user_id` 改为同时查
  `thread.team_id === currentTeamId()`，堵住跨团队用可枚举线程 id 越权读/写的口子。
- 新 e2e：`apps/web/e2e/ava-attach-files.spec.ts`（8 个 case，详见 progress.md）。

## 仍损坏或未验证
- F07（模型/Agent/工具切换）未开始；spec 里「此模式下不支持上传文件」的提示目前没有可挂载的
  模式切换 UI，留给 F07 落地时接上（`attachments.tsx` 暴露的组件加一个 disabled 态即可）。
- 本机是多 agent 共享开发机：并发多个 worktree 跑 docker/next dev/playwright/turbo 时
  load average 会冲到 30~100，导致本 worktree Postgres 容器出现
  `the database system is in recovery mode` 崩溃-恢复循环。依赖真实 HTTP 往返的 e2e（尤其
  文件上传）在高负载窗口期会偶发超时；机器空闲时同一份代码稳定 8/8。下一轮如再遇到类似失败，
  先用 `docker logs <postgres 容器名>` 和 `uptime` 确认是否是同样的争用模式，不要先怀疑代码回归。
- `feature_list.json` F08 的 `verification` 数组目前只有 playwright 命令本身，没有像部分其它
  feature 那样显式列出 `docker compose up` + `migrate` 前置步骤；coordinator 提过这点，非阻塞，
  可后续按需补充成两行 + 原命令的形式。

## 下一步最佳动作
- F08 已 passing，PR #170 待 coordinator 合并。
- 下一个 worker 接 F07 时：不要重新设计附件入口 UI，直接在 `attachments.tsx` 的
  `AttachmentTrigger` 上加一个 `disabled` prop（模式不支持上传时传 true + 展示
  「此模式下不支持上传文件」文案），复用现有的 `useAvaAttachments` hook 状态管理。
- 不要动 `packages/storage` 里 KB 原有的导出（`validateKbUpload`/`buildKbObjectKey` 等），
  AVA 相关校验/key 规则已独立成 `validateAvaUpload`/`buildAvaObjectKey`，两者互不影响。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p9/03`
- 调试:
  ```bash
  bash scripts/init-worktree-env.sh   # 生成本 worktree 专属端口，写入 apps/web/.env.local 和根 .env
  # 注意：本机 docker compose 版本不会自动读根目录 .env，需显式 --env-file
  docker compose --env-file .env -f infra/docker-compose.yml up -d
  DATABASE_URL=postgresql://boardx:boardx@localhost:61119/boardx pnpm --filter @repo/data run migrate
  E2E_PORT=61121 pnpm --filter @repo/web exec playwright test e2e/ava-attach-files.spec.ts
  ```
