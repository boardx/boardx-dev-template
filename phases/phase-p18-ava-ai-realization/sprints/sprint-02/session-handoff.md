# 会话交接 — Sprint p18/02

## 当前已验证
- F11（消息「发送到 Board」「发送邮件」接通，owner wrk-ava-p18-3）：`passing`。
  验证：`pnpm --filter @repo/web exec playwright test e2e/ava-message-send-actions.spec.ts`
  （5 passed）+ `pnpm -w run verify:base`（45/45）。证据：
  `phases/phase-p18-ava-ai-realization/sprints/sprint-02/evidence/F11.verify.log`。
- 其余 feature（F02/F03/F06/F07/F08/F09 等）状态以 `active-features.json` / `feature_list.json`
  为准，本次会话未改动，不重复列举。

## 本轮改动（F11）
- `packages/data/src/board.ts`：新增 `listEditableBoardsForUser`。
- `packages/data/src/mailbox.ts`：新增 `countRecentOutboundEmails`（邮件频控查询，复用既有
  `outbound_emails` 表，不引入新基础设施）。
- `apps/web/lib/mailer.ts`：新增 `sendAvaMessageEmail` + `RateLimitedError`（1 分钟内最多 1 封）。
- `apps/web/app/api/boards/route.ts`：新增 `GET ?scope=editable`。
- 新增路由：
  - `apps/web/app/api/ava/threads/[id]/messages/[messageId]/send-to-board/route.ts`
  - `apps/web/app/api/ava/threads/[id]/messages/[messageId]/send-email/route.ts`
- `apps/web/app/(app)/ava/page.tsx`：`MessageActionsBar` 两按钮从禁用占位改为真实动作，新增
  最小可用白板选择器（popover）。
- `apps/web/e2e/ava-message-actions.spec.ts`：占位断言（disabled）改为「默认可点击」。
- 新增 `apps/web/e2e/ava-message-send-actions.spec.ts`（5 用例）。

## 仍损坏或未验证
- 无新增已知损坏。已知边界（非 bug，按 notes 要求记录）：写入 Board 的内容是「便利贴文本」
  最小可用形态，不含 widget 级富投放（依赖 p6 未交付部分）；放置坐标固定 (40,40)，因触发
  来源是 AVA 侧栏而非打开的画布。

## 下一步最佳动作
- F11 已收口，PR 待 coord-ava 复核后转 coord-main 合并。
- sprint-02 剩余 feature 按各自 owner 并行推进；`04-close-out-placeholders.md` 四项占位中
  F11 已完成，F04/F07/F08 状态见其各自 owner 的记录。

## 命令
- 启动：`pnpm -w run dev`
- 验证：`pnpm harness verify --sprint p18/02 --feature F11`
- 调试：`pnpm --filter @repo/web exec playwright test e2e/ava-message-send-actions.spec.ts --reporter=list`
