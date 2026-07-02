# 会话交接 — Sprint p9/02

## 当前已验证
- F07 / AI 设置：模型/Agent/工具选择（发送前生效）已 passing。
- 已跑：`pnpm harness verify --sprint p9/02 --feature F07`
- 验证覆盖：
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/ava-ai-settings.spec.ts`
  - `pnpm -w run verify:base`
- 证据：`phases/phase-p9-ava-chat/sprints/sprint-02/evidence/F07.verify.log`

## 本轮改动
- `packages/ai/src/avaSettings.ts` 定义 AVA 模型/Agent/工具选项、默认设置、受限模型校验和设置归一化。
- `packages/ai/src/gateway.ts` / `packages/ai/src/graph.ts` 将模型/Agent/工具设置传入 stub 生成路径，并在 stub 回复中回显实际生效设置。
- `apps/web/app/api/ava/capabilities/route.ts` 新增能力列表 API，按当前团队角色禁用 team-restricted 模型。
- `apps/web/app/api/ava/threads/[id]/messages/route.ts` 接收 `modelId` / `agentId` / `toolIds`，服务端校验后再进入生成链路。
- `apps/web/app/(app)/ava/page.tsx` 在 composer 区新增设置区，支持发送前选择模型、Agent、工具；已有消息的线程禁用 Agent 切换。
- `apps/web/e2e/ava-ai-settings.spec.ts` 新增 F07 e2e。

## 仍损坏或未验证
- 无已知损坏。
- 已知边界：p11 AI Store 未接入前，Agent 数据源为内置默认/占位 Agent；真实订阅/团队 Agent 后续补充。
- 本 worktree 不处理 F02；F02 当前属于 owner `wrk-codex-1`。

## 下一步最佳动作
- 完成 commit 后交回。下一轮如继续本 worktree，应先重新读取 `active-features.json`，不要手改该派生文件。
- 不要 revert 其他 worktree 或其他 owner 的改动。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p9/02`
- 调试:`pnpm harness verify --sprint p9/02 --feature F07`
