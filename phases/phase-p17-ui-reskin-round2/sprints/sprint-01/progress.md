# 进度日志 — Sprint p17/01

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01（owner wrk-claude-1）已实现+自测全绿，等待 `pnpm harness verify` 门控翻 passing。F02-F06 由其他 owner 并行处理，见各自记录。
- 当前 blocker: 无（F01 自身）。注：`e2e/board-menu-001-use-board-menu.spec.ts` 存在一个与本 feature 无关的**既有**回归（addShape 新建的形状 items 断言 `toContainText("矩形")` 失败，item text 为空）——在 stash 掉 F01 全部改动后仍复现，已 spawn 独立后台任务跟进，不阻塞 F01。

## 会话记录
### 2026-07-05（coord/363-p17-f03-gate，F03 门控尝试）
- 本轮目标：对已合并的 PR #242（F03 — AI Store reskin，纯文案/样式改动）跑
  `pnpm harness verify --sprint p17/01 --feature F03` 门控。
- 前置：先合并了 `infra/docker-compose.yml` 子网硬编码修复（#384），用
  `scripts/init-worktree-env.sh` 在全新 worktree 里重新分配了互不冲突的端口/子网
  （`172.32.0.0/24`）。
- 顺带发现并修复：F03 verification 第 3 条命令 `pnpm --filter @repo/web exec playwright test
  e2e/ai-store-*.spec.ts` 在 `pnpm harness verify` 从 repo 根跑时，glob 相对根目录展开
  （根目录无 `e2e/`）导致 "No tests found"——与 F02 notes 里记录并修过的同一个 harness 执行
  环境 bug。已按 F02 的方式改成 `cd apps/web && pnpm exec playwright test e2e/ai-store-*.spec.ts`。
- 结果：修正 glob 后**门控仍未通过**。`docker compose up` / `migrate` 两条通过；
  `playwright test e2e/ai-store-*.spec.ts` 是 27/30，3 条失败（`ai-store-003:13`、
  `ai-store-005:116`、`ai-store-005:174`），与 PR #242 里 worker 报告的完全一致，
  证明这是 `store-browser.tsx` 里 P11 遗留的 URL query 竞态（与本次 docker 子网修复、glob
  修复均无关，也确认不是 F03 本次改动引入）。lint-design.sh 通过。
- 决定：F03 保持 `in_progress`，不豁免/不改 verification 范围。已单独 spawn 一个独立任务
  跟踪修复这个 share-landing 竞态（`task_20951276`，不占用 F03 owner，不阻塞其它 feature）。
  修复合并后需重新对 F03 跑一次门控。
- 证据：`evidence/F03-analysis.md`（追加"协调方复核"章节）、
  `evidence/F03-verify-gate-attempt-20260705.log`、`evidence/F03-e2e-run-20260705.log`。

### 2026-07-03 04:48:25
- 本轮目标: p17 sprint-01 全量派发（coordinator）。
- 已完成: claim 分配，scaffold sprint.md/progress.md/session-handoff.md。

### 2026-07-03（wrk-claude-1 / F01）
- 本轮目标: F01 — Board 内嵌 AI 浮层 + 底部工具 dock + board chat 面板。
- 已完成:
  - 新增 `apps/web/components/board/board-bottom-dock.tsx`：FigJam 风格底部悬浮工具 dock，复用
    `BoardCanvas` 既有 `activeTool`/`chooseTool` 真值，末尾 "Ask AI" 触发按钮。
  - 新增 `apps/web/components/board/board-ai-panel.tsx`：右下角圆形 AI 浮层触发按钮 + 唤起后停靠
    的 "Board AI" 面板（消息列表 + composer，U1/U2/U3 三态齐全：loading/empty/err-board-ai）。
    AI 回复为本地模拟应答（范围纪律：F01 verification 未要求新后端契约，不跨 feature 新增/复用
    其它 API）。
  - 改 `apps/web/components/board/board-canvas.tsx`：引入以上两个组件；新增 `aiOpen` 状态与
    `chooseDockTool` 映射函数（dock 工具点击 → 复用既有 `chooseTool`/`addNote`/`addText`/`addShape`）。
  - 新增 e2e `apps/web/e2e/board-ai-overlay.spec.ts`（3 个场景：dock 可见可用 + Ask AI 唤起/问答/
    收起；dock 新建便签与画布真值一致；无编辑权限时 dock 隐藏但 AI 浮层仍可用）。
- 运行过的验证（3 条均退出码 0，详见 evidence）:
  1. `docker compose -f infra/docker-compose.yml up -d`
  2. `pnpm --filter @repo/data run migrate`
  3. `pnpm --filter @repo/web exec playwright test e2e/board-ai-overlay.spec.ts` → 3 passed
  - 另外自测：`pnpm --filter @repo/web run typecheck`、`cd apps/web && bash scripts/lint-design.sh`
    （exit 0，仅既有 LABEL-LANG-MIX 警告，非本次改动引入）、`pnpm -w run verify:base`（45/45 通过）。
- 已记录证据:
  - `phases/phase-p17-ui-reskin-round2/sprints/sprint-01/evidence/F01-migrate.txt`
  - `phases/phase-p17-ui-reskin-round2/sprints/sprint-01/evidence/F01-verification.txt`
- 提交记录: 分支 `worker/wrk-claude-1-p17-f01-board-ai-overlay`，PR 见 GitHub issue #235（Closes #235）。
- 已知风险或未解决问题:
  - `board-menu-001-use-board-menu.spec.ts` 的既有回归（见上，非本 feature 引入，已 spawn 后台任务）。
  - Board chat 面板当前无持久化（纯客户端会话内状态），符合 F01 verification 范围；若后续要跨
    会话/跨用户持久化协作对话，需要新的 feature + 后端契约。
- 下一步最佳动作: 等待 reviewer 走 `pnpm harness verify --sprint p17/01 --feature F01` 门控翻 passing；
  不要在 F01 状态翻 passing 前顺手改动 board-canvas.tsx 其它区域。

### 2026-07-14 · coord-platform（issue #602 收口）
- 对账结论：F06 的 reskin 本体已达标（design lint 全绿），卡在验证链两处环境/回归问题：
  1) verification 里 `e2e/kb-*.spec.ts` glob 不被 playwright 展开（No tests found）→
     改为正则模式 `"kb-" "credits-"`；
  2) kb-004 的 enableFileReaderTool 还在直接点 `tool-file-reader`，但 p18-F13 起工具开关
     收进 composer Skill 菜单 → helper 先点 composer-skill-trigger 展开再点（main 上既有断裂）。
- 环境备忘：KB 文件 processing→ready 依赖 `apps/workflow-worker` 常驻进程（bullmq），
  e2e 前需手动起（playwright webServer 不含它）。
- `pnpm harness verify --sprint p17/01 --feature F06` 门控通过 → F06 passing（43/43 e2e +
  design lint + verify:base），证据 `evidence/F06.verify.log`。
- owner 仍登记为 wrk-credits-1（claim 防抢占，未改）；实际收口人 coord-platform，见本记录。
