# 进度日志 — Sprint p17/01

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01（owner wrk-claude-1）已实现+自测全绿，等待 `pnpm harness verify` 门控翻 passing。F02-F06 由其他 owner 并行处理，见各自记录。
- 当前 blocker: 无（F01 自身）。注：`e2e/board-menu-001-use-board-menu.spec.ts` 存在一个与本 feature 无关的**既有**回归（addShape 新建的形状 items 断言 `toContainText("矩形")` 失败，item text 为空）——在 stash 掉 F01 全部改动后仍复现，已 spawn 独立后台任务跟进，不阻塞 F01。

## 会话记录
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
