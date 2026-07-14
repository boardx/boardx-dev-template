# 会话交接 — Sprint p25/11

## 当前已验证
- F11 尚未 passing；F09/F10 已 passing 并在同一 PR 分支。

## 本轮改动
- 本 sprint 仅完成 Harness 认领和源/目标契约勘探，尚未写 F11 生产代码。

## 仍损坏或未验证
- events route 不能直接复制：目标 `surveyAi.ts` 尚无 `getSurveyAiSessionForMutation`、draft/change-set 事件仓储。

## 下一步最佳动作
- 继续 F11；先测试再做 039 migration。不要把生产 provider 改回 Anthropic，也不要允许跨 actor 读取 session。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/11`
- 调试:`pnpm --filter @repo/data run test -- surveyAi`
