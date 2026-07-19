# 会话交接 — Sprint p25/25

## 当前已验证
- F25 已由 `pnpm harness verify --sprint p25/25 --feature F25` 门控推进为 `passing`。
- feature 验证：web lint、web typecheck、五步视觉 Playwright、Harness doctor、证据日志存在性全部通过。
- 基础验证：`pnpm -w run verify:base` 通过，81/81 Turbo tasks 成功。

## 本轮改动
- `WorkspaceShell` 统一拥有五步工作流的满宽内容框、水平留白和稳定 `data-testid`。
- 设计问卷页改为满宽布局，移除与持久壳层重复的返回列表和 Survey Workflow 命令栏。
- 新增 F25 E2E，逐步切换 design/template/collect/answer/report 并断言共享内容几何稳定。
- F25 对应 GitHub Issue #805；一个 phase 使用一个 worktree，一个 feature 使用一个 Issue 和一个 PR。

## 仍损坏或未验证
- 无 F25 功能 blocker。
- PR 应暂时 stacked 到 `codex/p25-f19-template-driven-report`，避免把 PR #757 的 F19-F24 变更重复计入审查；#757 合并后 retarget 到 `main`。

## 下一步最佳动作
- 推送 `codex/p25-f25-unified-workflow-ui`。
- 创建独立 PR，正文包含 `Closes #805` 和 `Depends on #757`。
- 不要在该 PR 中加入 F26 或其他 Survey 功能。

## 命令
- 启动：`pnpm -w run dev`
- 验证：`pnpm harness verify --sprint p25/25 --feature F25`
- 调试：`E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-unified-workflow-visual-system.spec.ts`
