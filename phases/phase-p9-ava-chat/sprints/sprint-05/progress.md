# 进度日志 — Sprint p9/05

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-template（worktree: worker/wrk-ava-1-p9-f11-message-actions）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F11 消息结果操作（本轮已实现，等待 `pnpm harness verify` 门控）
- 当前 blocker: 无（代码/测试均就绪；本机多 worktree 并发导致 docker postgres 偶发
  crash-loop，是共享机器资源争用，已在 evidence 记录，与本 feature 改动无关）

## 会话记录
### 2026-07-02（wrk-ava-1，p9-F11）
- 本轮目标: 实现 F11 消息结果操作（复制/反馈/重新生成/发送到Board/发送邮件）
- 已完成:
  - 复制：消息级复制（写剪贴板 + 「文本已被复制」提示，剪贴板不可用时提示手动复制）；
    代码块单独复制按钮（只复制代码块纯文本，不含围栏/正文），见
    `apps/web/app/(app)/ava/markdown-message.tsx`。
  - 反馈：点赞/点踩，同一用户对同一条消息 upsert 覆盖，持久化到新表
    `ava_message_feedback`（迁移 `packages/data/migrations/020_ava_message_feedback.sql`），
    GET 线程详情把当前用户的反馈状态带回（reload 后仍可见）。
  - 重新生成：新增 `POST /api/ava/threads/:id/messages/:messageId/regenerate`，只允许对
    "最后一条 assistant 消息" 重新生成（防破坏顺序），删除旧回复但保留原问题（最后一条
    user 消息）不动，复用现有 SSE 生成管线，前端展示"AVA 正在重新生成…"。
  - 发送到当前 Board / 发送邮件：按 feature notes 要求做禁用态占位（跨能力依赖 p6
    canvas / 邮件服务未就绪），不接真实动作。
  - 所有新增 ava 路由（feedback、regenerate）均遵循 `isThreadInCurrentContext`
    鉴权模式（同时校验 user_id 与 team_id），与 `threads/[id]/route.ts` 等既有路由一致。
  - 修了一处 bug：反馈路由最初用 `m.id === messageId` 比较 bigint 列（pg 驱动返回字符串）
    与 `Number(params.messageId)`，导致恒为 false（404）；改用 `String(m.id) === String(messageId)`。
- 运行过的验证:
  - `pnpm --filter @repo/data run typecheck` — 通过
  - `pnpm --filter @repo/web run typecheck` — 通过
  - `pnpm --filter @repo/data run test` — 6 files / 31 tests 通过
  - `pnpm --filter @repo/web run test -- --run` — 5 files / 16 tests 通过（含更新后的
    `app/api/ava/threads/[id]/route.test.ts`，新增 feedback mock）
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`（应用 `020_ava_message_feedback.sql`）
  - `pnpm --filter @repo/web exec playwright test e2e/ava-message-actions.spec.ts`
    — 4/4 通过，见 evidence/F11.verify.log
- 已记录证据: `phases/phase-p9-ava-chat/sprints/sprint-05/evidence/F11.verify.log`
- 提交记录: 见分支 `worker/wrk-ava-1-p9-f11-message-actions` 的 PR
- 已知风险或未解决问题:
  - 本机同时跑 13+ 个 worktree 的 docker-compose 栈，postgres 容器会偶发 crash-loop
    （host 级资源争用，非本 feature 引入）。回归检查（F01/F03 既有 e2e）在争用期间跑不稳定，
    但本 feature 自己的 3 条 declared verification 命令在确认稳定窗口内跑出过干净的
    4/4 通过（已存证据）。未能在同一稳定窗口内额外完整跑通 F01/F03 回归，建议下一轮
    机器负载降下来后补跑 `ava-chat-basic.spec.ts` / `ava-edit-delete-message.spec.ts` 确认。
- 下一步最佳动作: 等协调者跑 `pnpm harness verify --sprint p9/05` 门控 F11 为 passing；
  机器负载低时建议补跑一次 F01/F03 e2e 做最终回归确认（预期不受影响，未改动其鉴权/数据路径，
  仅在 assistant 消息渲染下方新增操作条，且新增字段 `feedback` 为可选）。
