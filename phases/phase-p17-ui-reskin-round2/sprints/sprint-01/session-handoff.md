# 会话交接 — Sprint p17/01

## 当前已验证
- F06「Knowledge Base + Credits 页面收尾 reskin」：视觉改动已完成（4 个文件，纯 token 级字号/宽度微调）。
  - `pnpm --filter @repo/web exec playwright test e2e/kb-*.spec.ts e2e/credits-*.spec.ts`：42/43 通过。
  - `cd apps/web && bash scripts/lint-design.sh`：exit 0，全部通过。
  - 用真实、完整的 CAP-WORKFLOW（`apps/workflow-worker` 已启动）跑的，不是阉割配置。

## 本轮改动
- `apps/web/app/(app)/credits/page.tsx`：SummaryCard label 字号 `text-xs` → `text-11`
- `apps/web/app/(app)/knowledge-base/page.tsx`：文件列表字号统一 `text-12` → `text-11`，
  操作列宽度 `min-w-18` → `min-w-20`
- `apps/web/components/credits/buy-credits-dialog.tsx`：套餐金额 `text-16` → `text-15`，
  支付状态提示 `text-14` → `text-13`
- `apps/web/components/credits/credit-records-dialog.tsx`：摘要数值 `text-20` → `text-22`
- 证据文件：`phases/phase-p17-ui-reskin-round2/sprints/sprint-01/evidence/F06-*`

## 仍损坏或未验证
- kb-004（`e2e/kb-004-use-file-in-ai-context.spec.ts:100`）"处理中文件不参与检索"用例失败，
  **已确认是 pre-existing、与本次改动无关**（对比实验：stash 改动后同样失败，见
  `evidence/F06-kb-004-preexisting-failure-stash-check.log`）。根因：该用例依赖文件
  长时间停留在 processing 状态断言不被引用，但同条验证命令里 kb-001 要求真实 workflow-worker
  必须运行并快速把文件推进到 ready——两者对 worker 运行状态的假设互斥，是 p10 阶段测试设计
  本身的矛盾。已开 background task `task_7bd99360` 跟踪修复。
  **本次未弱化、未跳过这条验证命令，如实记录失败。**
- `pnpm harness verify` 是否因这条已知 gap 暂缓把 F06 翻 passing，由验证脚本判定，
  不是本轮需要解决的问题。

## 下一步最佳动作
- 等 PR review（Closes #240）+ harness verify 门控结果。
- 若需要 F06 翻 passing：先处理 task_7bd99360（重写 kb-004 该用例，避免依赖真实 worker
  时序假设，例如显式 mock 队列消费或用测试专属 hook 阻止该 job 被消费），不要回头改 F06
  的视觉 diff（视觉部分本身零回归）。
- 不要重新引入"绕过 workflow-worker"的阉割验证配置——之前已确认那样会导致 kb-001 假失败/假通过。

## 命令
- 启动：`pnpm -w run dev`
- 验证：`pnpm harness verify --sprint p17/01`
- 调试：
  - 启动本 worktree docker 栈：`docker compose -f infra/docker-compose.yml -p <project-name> up -d`
  - 迁移：`pnpm --filter @repo/data run migrate`
  - 启动 workflow-worker：`cd apps/workflow-worker && pnpm run dev`
  - 单独重跑 e2e：`cd apps/web && npx playwright test e2e/kb- e2e/credits-`
