# 会话交接 — Sprint p25/01

## 当前已验证
- F01 已由 `pnpm harness verify --sprint p25/01 --feature F01` 门控升级 passing；data typecheck/test、web typecheck、Playwright 和 verify:base 全部通过。

## 本轮改动
- 新增 `036_survey_system_p25.sql`，扩展 Survey 发布策略和报告模板。
- 数据仓储保留 private/team/room 权限并增加发布、答卷和报告模板能力。
- collection/detail/answer/responses API 接入真实生命周期字段与服务端门禁。
- Phase p25 requirements、UI signoff、feature list、截图和实现计划已落盘。

## 仍损坏或未验证
- F02-F06 未验证；源分支的 AI session 数据函数和 `callQwenJson` 在源仓库中不存在，后续必须使用本仓库 `@repo/ai` 实现，不可照抄破损引用。

## 下一步最佳动作
- 从 F02 开始；复用已确认 UI，不改信息架构；不要删除 Room Survey 权限分支。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/01`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-001-source-baseline.spec.ts --grep "survey list preserves publish settings"`
