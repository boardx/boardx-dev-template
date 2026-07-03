# 会话交接 — Sprint p17/01

## 当前已验证
- F01（owner wrk-claude-1）：代码已实现，3 条 verification 命令自测全绿（见
  `evidence/F01-verification.txt`），typecheck/lint-design/verify:base 均通过。**尚未** 经
  `pnpm harness verify` 门控，仍是 `in_progress`（禁止手改 status）。PR 已开，Closes #235。
- F02-F06：见各自 owner 的记录（本文件是共享 sprint 交接，非 F01 独占）。

## 本轮改动（F01）
- 新增 `apps/web/components/board/board-bottom-dock.tsx`（底部悬浮工具 dock）。
- 新增 `apps/web/components/board/board-ai-panel.tsx`（AI 浮层触发 + Board AI 停靠面板）。
- 改 `apps/web/components/board/board-canvas.tsx`（接入以上两组件 + `aiOpen` 状态 + `chooseDockTool`）。
- 新增 `apps/web/e2e/board-ai-overlay.spec.ts`。
- 分支：`worker/wrk-claude-1-p17-f01-board-ai-overlay`。

## 仍损坏或未验证
- `e2e/board-menu-001-use-board-menu.spec.ts` 有既有回归（addShape 新建形状 item 断言
  `toContainText("矩形")` 失败，text 为空），**验证过与 F01 无关**（stash 掉 F01 全部改动后仍复现）。
  已 spawn 独立后台任务跟进，不阻塞 F01 verify。
- Board AI 面板当前无跨会话持久化（纯客户端会话内 state），如需要后续单独立项。

## 下一步最佳动作
- Reviewer：对 F01 的 PR 跑 `pnpm harness verify --sprint p17/01 --feature F01` 门控。
- 下一轮如果继续 F01 相关工作，先看这个 handoff + PR 评论，不要跳过既有 review 意见重做。
- 不要顺手把 `board-menu-001` 的既有回归揉进 F01 的提交里——那是独立 task。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p17/01`
- F01 单独验证:`docker compose -f infra/docker-compose.yml up -d && pnpm --filter @repo/data run migrate && pnpm --filter @repo/web exec playwright test e2e/board-ai-overlay.spec.ts`
