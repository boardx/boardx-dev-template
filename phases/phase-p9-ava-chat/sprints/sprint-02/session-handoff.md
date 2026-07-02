# 会话交接 — Sprint p9/02

## 当前已验证
- F06 Deep Research 已 passing。最终门控命令：`pnpm harness verify --sprint p9/02 --feature F06`。

## 本轮改动
- `apps/web/app/(app)/ava/page.tsx`: 增加 Deep Research/Chat 模式切换、研究处理中卡片、澄清问题、计划确认、执行时间线、报告通知和报告详情面板。
- `apps/web/app/api/ava/threads/[id]/research/route.ts`: 新增 thread-scoped stub research engine；校验短主题/额度不足/启动失败，并将研究主题与最终报告消息写入现有 AVA messages。
- `apps/web/e2e/ava-deep-research.spec.ts`: 覆盖成功流、短主题、额度不足、启动失败和报告后继续追问。

## 仍损坏或未验证
- 无已知功能 blocker。
- sandbox 内普通权限运行 `docker compose`、`tsx` migration/harness、Playwright webServer 会遇到权限限制；本轮使用 escalated 后验证全部通过。

## 下一步最佳动作
- 继续 sprint p9/02 中其他未 passing feature。不要手改 `active-features.json`；F06 状态和 evidence 已由 harness 写入。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p9/02`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/ava-deep-research.spec.ts`
