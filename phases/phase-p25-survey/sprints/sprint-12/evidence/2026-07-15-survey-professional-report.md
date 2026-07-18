# Survey 专业报告逻辑证据

## 修复范围
- 真实答卷证据聚合与每题独立统计。
- AI 证据引用及数值一致性校验。
- 零样本、低样本和模型失败边界。
- 专业报告页面与 A4 PDF/Word 导出。

## 自动验证
- `pnpm exec vitest run lib/survey-report-evidence.test.ts lib/survey-professional-report.test.ts lib/report-export.test.ts`: 3 files passed, 9 tests passed。
- `pnpm --filter @repo/web run typecheck`: exit 0。
- `pnpm --filter @repo/web run lint`: design lint passed；仅仓库既有语言混用警告。
- `git diff --check`: exit 0。
- `E2E_PORT=3010 COLLAB_WS_PORT=3011 pnpm --filter @repo/web exec playwright test e2e/survey-p25-012-report-composer.spec.ts --reporter=line`: 3 passed。

## 已证明行为
- 零答卷报告的执行摘要为空，所有章节不产生图表值。
- 性别和年级等不同题目的选项不会进入同一图表。
- 多选题的选择率分母为该题有效答题人数。
- 少于 30 份样本时结论和章节均标记为方向性。
- 不存在或数值不一致的 AI evidence claim 被丢弃。
- A4 导出包含样本量、数据来源、方法和限制，不包含“模拟数据”“预览维度”或 AI 工作台控件。
- API 和页面端到端均证明零样本不会生成虚构报告。

## 保留边界
- F12 仍有异步任务、失败重试和真实供应商成功分支未完成，不标记 passing。
