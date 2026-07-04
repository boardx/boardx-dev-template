# 会话交接 — Sprint p18/01

## 当前已验证
- F03（Deep Research 持久化实体 + 刷新恢复）passing：
  `pnpm --filter @repo/data run migrate` + `pnpm --filter @repo/web exec playwright
  test e2e/ava-research-persistence.spec.ts`（4 passed）+
  `pnpm harness verify --sprint p18/01 --feature F03` 门控通过（含 verify:base 45/45）。

## 本轮改动
- 修了一个真实竞态：`apps/web/app/(app)/ava/page.tsx` 的 `confirmResearchPlan()`
  此前先乐观更新 UI 再 fire-and-forget PATCH 持久化，用户点击「确认计划」后极短
  窗口内刷新会读到 DB 里仍是 draft 的行，UI 却已显示 running。改为
  `persistResearchProgress` 返回 Promise，`confirmResearchPlan` 改 async 并
  await 持久化成功后再翻本地 state（动画定时器里的逐帧 PATCH 仍是
  fire-and-forget，不受影响）。
- 修正 `e2e/ava-research-persistence.spec.ts` 一处断言大小写不匹配
  （`"audience"` → `"Audience:"`）。
- 补跑迁移：前一轮遗留的 evidence 日志显示 024_ava_research_sessions.sql 曾未
  落库（migrate 日志停在 021），本轮重跑后 022/023/024 三个新迁移已正确应用。

## 仍损坏或未验证
- 无与 F03 相关的已知问题。
- main 的 verify:full 此前有既有 e2e 失败记录（与 p18 无关，另有独立修复任务），
  本轮未重新扫描 verify:full，只跑了 verify:base（45/45 通过）。
- F09（Agent 真实数据）仍等 p11:F03 转 passing，不要提前动。

## 下一步最佳动作
- 查 `active-features.json` 领取下一个 `owner: null` 或已认领但未完成的 feature
  （F02/F07/F09 等，视依赖是否已解锁）。
- F02（真实模型失败态/停止生成）依赖的 F01 已 passing，可开工。
- 不要动 `apps/web/e2e/ava-chat-basic.spec.ts`（另一会话可能仍在修）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p18/01`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/ava-research-persistence.spec.ts -- --reporter=list`
