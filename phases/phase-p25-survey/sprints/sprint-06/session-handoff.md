# 会话交接 — Sprint p25/06

## 当前已验证
- F06 passing；完整 p25 Playwright 10/10、data 61/61、web lint/typecheck、doctor、verify:base 均通过。

## 本轮改动
- 完成跨 F01-F05 的全生命周期回归和降级验证，修正冷启动测试等待，确认审计证据全部进入 Git。

## 仍损坏或未验证
- 未使用真实千问密钥做外网调用；mock 契约已验证，生产接口有超时、JSON 清洗和明确错误。
- DOCX/长图/单图不是源分支当前能力，未交付且未假 passing。

## 下一步最佳动作
- 本阶段无未完成 feature；下一轮只处理 code review/PR 反馈，不扩展功能范围。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/06`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-001-source-baseline.spec.ts e2e/survey-p25-002-professional-ui.spec.ts e2e/survey-p25-005-export-artifacts.spec.ts`
