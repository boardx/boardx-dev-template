# F06 — Knowledge Base + Credits 页面收尾 reskin — 证据说明

## 改动范围
纯视觉 token 微调，无行为改动：
- `apps/web/app/(app)/credits/page.tsx`：SummaryCard label 字号 `text-xs` → `text-11`
- `apps/web/app/(app)/knowledge-base/page.tsx`：文件列表表头/单元格字号 `text-12` → `text-11`，
  操作列最小宽度 `min-w-18` → `min-w-20`（避免图标被挤压）
- `apps/web/components/credits/buy-credits-dialog.tsx`：套餐金额字号 `text-16` → `text-15`，
  支付成功/失败提示字号 `text-14` → `text-13`
- `apps/web/components/credits/credit-records-dialog.tsx`：摘要数值字号 `text-20` → `text-22`

无 data-testid、无组件结构、无 API 调用改动。

## 环境配置（方案 1：正确的 CAP-WORKFLOW 配置）
- Docker compose：独立 project（隔离 postgres/redis/minio 端口，不与其他并行 worktree 冲突）
- `pnpm --filter @repo/data run migrate`：全部迁移已应用（幂等跳过）
- **`apps/workflow-worker` 已启动**（`pnpm run dev`，监听
  `boardx.jobs` / `boardx.kb-file-processing` / `boardx.studio-generation` /
  `boardx.presentation-generation` / `boardx.presentation-revision`）
  —— 这是本次的关键修正：之前用错误配置（worker 未启动）跑验证会导致 kb-001 的上传轮询永远等不到
  `ready`，是另一种误报；这次用**真实、完整**的 CAP-WORKFLOW 跑全套 e2e。

## 验证结果

### 1. `pnpm --filter @repo/web exec playwright test e2e/kb-*.spec.ts e2e/credits-*.spec.ts`
完整日志：`F06-kb-credits-playwright.log`

**42 passed, 1 failed**（43 个用例）。

失败用例：
```
kb-004-use-file-in-ai-context.spec.ts:100:5
› 处理中（未 ready）的文件不参与检索，不出现在引用里
```

### 2. `cd apps/web && bash scripts/lint-design.sh`
完整日志：`F06-lint-design.log`

**exit 0**。末尾：`✓ design lint: 全部通过（颜色/间距/原生元素/微交互/无障碍/状态完整性/文案语言一致性）`
（仅有跨文件/同文件中英文案混用的既有 WARNING，不拦截，脚本注明"修复归属 phase-p17 reskin"——
本次改动未新增任何 lint 违规。）

## kb-004 失败根因分析（已知 pre-existing gap，与 F06 视觉改动无关）

`kb-004-use-file-in-ai-context.spec.ts` 第 100 行的用例上传一个文件后**刻意不调用
`setKbFileStatus`**，依赖文件"保持默认 processing 状态"，然后断言 AI 回复不应引用这个仍在
processing 的文件。

这个假设只有在**没有真实 workflow-worker 消费队列**时才成立。而 F06 的 verification 要求的是
真实、完整的 CAP-WORKFLOW（同一条命令里 kb-001 明确需要真实 worker 把上传文件从 processing
推进到 ready，见 kb-001 用例注释"真实链路：...入队 boardx.kb-file-processing → workflow-worker
回写 processing → ready"）。

也就是说：
- kb-001 要求 workflow-worker **必须**运行，否则上传测试会因等不到 `ready` 而超时失败。
- kb-004 该用例要求文件**必须停留**在 processing 状态足够久，断言才有意义。

这两个前提在同一个真实 worker 环境下互斥：worker 一旦跑起来，测试 fixture 里那个几字节的
stub 文件几乎立刻就被处理完成变成 `ready`（stub pipeline 本身设计成快速完成用于测 kb-001），
于是 kb-004 第 100 行这条用例在断言前文件已经变成 ready，AI 回复因此（正确地）引用了它，
断言"不应引用"随之失败。

**这是 p10 阶段知识库测试设计本身的矛盾（kb-001 与 kb-004 对 workflow-worker 运行状态的假设互斥），
不是 F06 视觉改动引入的回归。**

### 对比验证：stash F06 改动后同样失败
完整日志：`F06-kb-004-preexisting-failure-stash-check.log`

把本次 4 个文件的视觉 diff 完整 `git stash`（working tree 回到改动前状态）后，用同一套
已启动的 workflow-worker + docker 环境单独跑 `kb-004-use-file-in-ai-context.spec.ts`：
**5 passed, 1 failed**——同一个用例（`处理中（未 ready）的文件不参与检索，不出现在引用里`，
同样在第 111 行断言处失败，失败原因逐字相同："AI收到...引用来源：still-processing-doc.pdf"）。
之后 `git stash pop` 已恢复本次视觉改动。

结论：kb-004 这条失败与 F06 的视觉改动**完全无关**——改动前后行为一致，是环境/测试设计层面
的既有 gap，不在 F06 范围内修复。

## 后续跟踪
已开 background task `task_7bd99360` 跟踪 kb-001/kb-004 互斥问题的修复（预期方向：kb-004 该用例
改用 mock/stub 队列消费者，或显式暂停 worker 消费该 job，而不是依赖真实 worker"恰好还没处理完"
的时序假设）。F06 不等待该修复落地。

## 结论
- F06 视觉改动本身：零回归，42/43 通过，lint-design 干净通过。
- 唯一失败项 kb-004 是已知、pre-existing、与本 feature 范围无关的测试设计问题，已如实记录、
  已用对比实验证明非本次引入，已另开 task 跟踪，不在本 PR 修复范围内。
