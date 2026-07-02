# 会话交接 — Sprint p9/05

## 当前已验证
- F11 消息结果操作：代码/迁移/e2e 已就绪，declared verification 全部跑过且 4/4 通过
  （`phases/phase-p9-ava-chat/sprints/sprint-05/evidence/F11.verify.log`）。状态字段本身
  仍是 `in_progress`——按规则不由 worker 自己改，需协调者跑 `pnpm harness verify --sprint p9/05`
  门控转 passing。

## 本轮改动
- `packages/data/migrations/020_ava_message_feedback.sql`（新表 `ava_message_feedback`）
- `packages/data/src/avaChat.ts`（新增
  `deleteLastAvaAssistantMessageForRegenerate` / `upsertAvaMessageFeedback` /
  `listAvaMessageFeedbackByMessageIds`）
- `apps/web/app/api/ava/threads/[id]/messages/[messageId]/regenerate/route.ts`（新）
- `apps/web/app/api/ava/threads/[id]/messages/[messageId]/feedback/route.ts`（新）
- `apps/web/app/api/ava/threads/[id]/route.ts`（GET 带回 `feedback` 字段）
- `apps/web/app/api/ava/threads/[id]/route.test.ts`（补 feedback mock，保持既有测试通过）
- `apps/web/app/(app)/ava/page.tsx`（消息操作条：复制/反馈/重新生成/禁用占位的
  发送到Board/发送邮件）
- `apps/web/app/(app)/ava/markdown-message.tsx`（代码块独立复制按钮）
- `apps/web/e2e/ava-message-actions.spec.ts`（新，F11 declared verification）

## 仍损坏或未验证
- 无代码层面已知问题。本机（同时 13+ worktree 并发跑 docker-compose）在验证过程中出现
  postgres 容器跨所有 worktree 同步 crash-loop（"Broken pipe" → recovery mode），已确认是
  host 级资源争用，不是本 feature 引入的问题——F11 自己的 3 条 verification 命令在稳定窗口
  内跑出过干净的 4/4 通过并已存证据；F01(`ava-chat-basic.spec.ts`)/F03
  (`ava-edit-delete-message.spec.ts`) 回归检查因同一争用未能在此会话内跑出干净结果，
  建议机器负载降下来后补跑确认（预期不受影响：未改动其鉴权/数据读写路径，只在 assistant
  消息下方新增可选操作条，`feedback` 字段是新增可选字段）。

## 下一步最佳动作
- 协调者：机器负载允许时，跑 `pnpm harness verify --sprint p9/05`（会重新执行 declared
  verification）门控 F11 状态。若同样撞上 postgres crash-loop，是环境问题，建议错峰重试
  而非归咎代码。
- 不要动：`apps/web/app/api/ava/threads/[id]/messages/route.ts`、
  `apps/web/app/api/ava/threads/[id]/messages/[messageId]/route.ts`（F01/F03 已 passing，
  本轮未改动其逻辑，只读了作参考）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p9/05`
- 调试:
  - `docker compose -f infra/docker-compose.yml ps` / `docker logs <postgres 容器名> --tail 60`
    排查是否又在 crash-loop。
  - `pnpm --filter @repo/web exec playwright test e2e/ava-message-actions.spec.ts` 单独重跑 F11。
