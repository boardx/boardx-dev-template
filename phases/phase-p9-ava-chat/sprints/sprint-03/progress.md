# 进度日志 — Sprint p9/03

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-template（本次在 worktree `.claude/worktrees/agent-a9fd9201c72b3d88b` 中开发，
  分支 `worker/wrk-ava-1-p9-f08-attachments`）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无（本 sprint 唯一 feature F08 已通过 `pnpm harness verify --sprint p9/03`
  门控为 `passing`）
- 当前 blocker: 无

## 会话记录
### 2026-07-01～02 (wrk-ava-1)
- 本轮目标: 实现 F08（向聊天附加文件/图片/音频）：composer 附件入口 + 拖拽上传、预览条
  （上传中/失败/重试/文件名/缩略图）、可移除/继续添加、超数量/类型不支持/超大小提示、
  附件随消息发出后进入聊天历史、AI（stub）基于附件文件名回复。
- 已完成:
  - `packages/data/migrations/018_ava_message_attachments.sql` + `packages/data/src/avaChat.ts`
    新增 `ava_message_attachments` 仓储（`message_id` 为空 = 暂存态，发消息时回填关联）。
  - `packages/storage/src/index.ts` 新增 AVA 专用校验/key 规则（`validateAvaUpload`、
    `buildAvaObjectKey`、`avaAttachmentKind`；20MB/单条消息最多 5 个附件；object key 前缀
    `ava/{userId}/{attachmentId}/{name}`，与 KB 的 `kb/...` 隔离），复用 p10 的 S3/MinIO 客户端层。
  - 新 API：`POST/DELETE /api/ava/threads/:id/attachments[/:attachmentId]`（上传/移除暂存附件）、
    `GET /api/ava/attachments/:attachmentId/url`（预览用临时签名直链）；
    `POST /api/ava/threads/:id/messages` 扩展支持 `attachmentIds`，发消息时关联暂存附件、
    把文件名拼进传给 stub LLM 的上下文（`packages/ai/src/gateway.ts` 的 `buildStubReply` 据此在
    回复里引用文件名）。
  - `apps/web/app/(app)/ava/attachments.tsx`（新）：`useAvaAttachments` hook + 预览条/入口组件；
    接入 `apps/web/app/(app)/ava/page.tsx`（拖拽区、发送按钮在上传中时禁用、消息气泡渲染附件）。
  - 顺手修了 #153：`threads/[id]/route.ts`、`threads/[id]/messages/route.ts` 的鉴权只查
    `user_id` 未查 `team_id` 的跨团队越权缺口（同一文件territory，成本低，一并加了
    `thread.team_id !== currentTeamId()` 检查）。
  - 新 e2e：`apps/web/e2e/ava-attach-files.spec.ts`（8 个 case：选图上传→预览→发送→历史展示→
    AI 引用文件名；拖拽上传；类型/大小/数量校验失败态；移除附件；服务端二次校验 400；未登录 401）。
- 运行过的验证:
  - `docker compose --env-file .env -f infra/docker-compose.yml up -d`（worktree 隔离端口：
    PG_PORT=61119 / REDIS_PORT=61120 / MINIO_PORT=51253 / MINIO_CONSOLE_PORT=51254，避免与同机
    其它并行 worktree 冲突；注意本机 docker compose 版本不会自动读根目录 `.env`，需显式
    `--env-file .env`）。
  - `DATABASE_URL=... pnpm --filter @repo/data run migrate`（含新迁移 018，exit 0）。
  - `pnpm --filter @repo/web exec playwright test e2e/ava-attach-files.spec.ts` — 8/8 passed
    （多次独立运行确认稳定；早前受本机同时多个 worktree 并发导致的资源争用影响出现过 2 个
    上传往返用例超时，机器负载降下来后稳定复现 8/8 绿，详见下方「已知风险」与
    `evidence/F08-NOTES.md`）。
  - `pnpm --filter @repo/web exec playwright test e2e/ava-chat-basic.spec.ts` — 5/5 passed
    （F01 回归确认未破坏聊天壳/流式回复）。
  - `pnpm --filter @repo/web exec playwright test e2e/kb-001-upload-file.spec.ts`
    （起 `workflow-worker` 后）— 5/5 passed（`packages/storage` 是共享包，确认未破坏 KB/p10 上传）。
  - `pnpm --filter @repo/storage test`（19/19，含新 AVA 校验/key 单测）、
    `pnpm --filter @repo/data test`、`pnpm --filter @repo/ai test`、
    `pnpm --filter @repo/web test`（vitest 单测）— 全部通过。
  - `pnpm --filter @repo/web typecheck`、`@repo/storage typecheck`、`@repo/ai typecheck` — 干净。
  - `pnpm --filter @repo/web lint`（design lint）— 干净（改用 `components/ui/file-input`/
    `components/ui/button`、token 字号 `text-9`/`text-10` 替代任意 px 值后通过）。
  - `pnpm harness verify --sprint p9/03` — **通过**（含 `require_base_pass` 触发的
    `pnpm -w run verify:base` 45/45 successful），F08 门控转 `passing`。
- 已记录证据: `phases/phase-p9-ava-chat/sprints/sprint-03/evidence/`
  - `F08.verify.log`（harness verify 产出，8/8 e2e + 全量 base verify，exit 0）
  - `F08-standalone-passing.log`、`F08-regression-f01-ava-chat-basic.log`（补充的独立运行证据）
  - `F08-NOTES.md`（记录本机共享资源争用导致的间歇性失败现象及排查过程，供后续复盘）
- 提交记录: `worker/wrk-ava-1-p9-f08-attachments` 分支，PR #170（`Closes #107`），code review
  已过（`review:code-ok`，确认 #153 修复正确完整），feature review 因证据日志 stale 一度 blocked，
  已用本轮的干净 `harness verify` 重跑结果覆盖。
- 已知风险或未解决问题:
  - 本机是多 agent 共享开发机，同时跑多个 worktree 的 docker/next dev/playwright/turbo 会让
    load average 冲到 30~100，进而导致本 worktree 的 Postgres 容器出现
    `the database system is in recovery mode` 崩溃-恢复循环，使依赖真实 HTTP 往返的 e2e 用例
    （尤其上传类）在高负载窗口期偶发超时。这是环境限制，不是应用代码缺陷（同一份代码机器空闲时
    稳定 8/8）。下一轮如遇到类似现象，先查 `docker logs <postgres 容器名>` 和 `uptime` 确认是否
    是同样的争用模式，而不是直接怀疑代码回归。
  - `feature_list.json` F08 的 `verification` 目前只列了 playwright 命令本身，未像部分其它
    feature 一样显式列出 `docker compose up` + `migrate` 前置步骤；coordinator 建议可选补充，
    非阻塞，留给后续按需处理。
  - F07（模型/Agent/工具切换）尚未开始，spec 里「此模式下不支持上传文件」的提示暂无适用场景
    （没有模式切换 UI 可显示这个态），留给 F07 落地后再补。
- 下一步最佳动作:
  - coordinator：F08 已 `passing`，可合并 PR #170。
  - 下一个 worker 若要接 F07（模型/Agent/工具切换），届时需要在切到「不支持附件」的模式时
    禁用/隐藏 composer 的附件入口并展示「此模式下不支持上传文件」——可直接复用本 feature 暴露的
    `AttachmentTrigger`/`useAvaAttachments`（`apps/web/app/(app)/ava/attachments.tsx`），
    加一个 disabled 态即可，不需要重新设计。
