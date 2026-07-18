# Survey HTML Fidelity Final Verification

日期: 2026-07-17

## 结果

- `bash apps/web/scripts/lint-design.sh`: PASS。颜色、间距、原生元素、微交互、无障碍和状态完整性门禁通过；仅保留归属 phase-p17 的非阻断语言混用警告。
- `pnpm --filter @repo/web test`: PASS，21 files / 107 tests。
- `pnpm --filter @repo/web run typecheck`: PASS。
- `E2E_PORT=3001 pnpm --filter @repo/web exec playwright test e2e/survey-p25-002-professional-ui.spec.ts e2e/survey-p25-005-export-artifacts.spec.ts e2e/survey-p25-008-source-stash-ui.spec.ts e2e/survey-p25-010-source-workspace.spec.ts e2e/survey-p25-011-qwen-ai-workflow.spec.ts e2e/survey-p25-012-report-composer.spec.ts`: PASS，35 tests。
- `pnpm harness doctor --phase p25`: PASS，0 FAIL / 0 WARN。
- `pnpm -w run verify:base`: PASS，58 successful / 58 total。
- `git diff --check`: PASS。

## 回归修正记录

组合 Playwright 首轮为 28/29。失败用例仍要求“添加假设”输入区初始可见，而指定 HTML 和当前实现均为按需展开。测试改为先验证并点击 `open-hypothesis-composer`，再断言编辑区出现；该用例单独通过后，完整 29 条组合回归再次通过。

独立代码审查随后发现低样本结论、摘要隐私、返回来源、移动结果页和首页报告计数边界。先新增 4 组失败验收，再修正为：

- 默认汇总接口将开放题、联系方式、文件等答案投影为“是否作答”，不下发原始文本或内部答卷 ID；完整答案只在授权用户进入单份答卷视图后按需加载。
- 样本门槛按每个量化维度和 NPS 的唯一有效答卷数独立判断；同一维度的多道量表题不会重复放大样本，总答卷达到 30 但某指标覆盖不足时仍只呈现方向性统计。
- 当前未存储独立假设时不生成支持/不支持结论；纯开放题问卷明确显示“尚无有效量化维度”，不虚构 `0.0 / 5`。
- 编辑器、工作流和直接访问分别返回原工作区、对应步骤或我的问卷列表。
- `390 x 844` 结果页在真实报告内容下提供移动导航且无横向溢出或裁切。
- “生成报告”从持久化 `survey_ai_report_artifacts` 聚合，真实零值显示 `0`；答卷数和报告数改用独立相关聚合，避免 `response × artifact` 笛卡尔中间集。

最终组合回归扩展为 35/35。

## Harness 状态

`pnpm harness verify --sprint p25/12 --feature F12` 返回 `F12 已 passing，跳过（不可逆）`。F12 的原始门控执行记录保存在 `F12.verify.log`；本文件记录 UI 重构收尾后的新增完整回归。
