# 进度日志 — Phase p26 ava-legacy-sync

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/phase-p26-ava`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F02 / 迁移旧 AVA composer 与消息动作能力
- 当前 blocker: 无；F01 已由 `pnpm harness verify --sprint p26/01 --feature F01` 升级为 passing。

## 会话记录
### 2026-07-15
- 本轮目标: 建立 phase-p26-ava，将旧 boardx-web / boardx-backend 的 AVA 同步工作纳入 harness，并先落地旧后端 `/v1/chat/*` 调用面的兼容 API。
- 已完成:
  - 创建 `phase-p26-ava-legacy-sync`，写入 requirements 与 4 个可验证 feature。
  - 创建 sprint `p26/01`，分配并认领 F01（owner: `codex-ava`）。
  - 新增 `apps/web/lib/ava-legacy-compat.ts`，把旧 DTO 字段映射到当前 `@repo/ai` 网关。
  - 新增 `/api/v1/chat/*` 兼容路由覆盖旧 `getModel`、widget、widgetV2、title、chat、translate、digitize whiteboard 调用面。
  - F01 已 passing。
- 运行过的验证:
  - `pnpm --filter @repo/web test -- lib/ava-legacy-compat.test.ts app/api/v1/chat/handleRequestAIChat/route.test.ts`
  - `pnpm --filter @repo/web typecheck`
  - `pnpm harness verify --sprint p26/01 --feature F01`（内部含 `pnpm -w run verify:base`）
  - `pnpm harness verify --sprint p26/01 --feature F01 --backfill-evidence`（review 后补跑 route-level tests 并刷新 evidence）
- 已记录证据:
  - `phases/phase-p26-ava-legacy-sync/sprints/sprint-01/evidence/F01.verify.log`
- 提交记录:
  - 尚未提交。
- 已知风险或未解决问题:
  - F01 是兼容 API 基线，不等于旧 AVA UI 全量迁移完成。
  - F02/F03 需要继续对照旧 `boardx-web/src/components/ava`，但不要照搬旧 Redux 服务层。
- 下一步最佳动作:
  - 开 sprint-02 或继续分配 F02，迁移旧 composer / ChatItem 行为并用既有 AVA Playwright specs 验证。
