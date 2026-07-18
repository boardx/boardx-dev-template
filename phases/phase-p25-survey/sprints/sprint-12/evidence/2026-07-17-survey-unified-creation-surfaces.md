# Survey 统一创建界面证据

日期: 2026-07-17

## 可见行为

- 新建问卷统一通过选择器进入 AI 对话、诊断模板或空白问卷。
- 模板中心使用标签过滤和双列诊断模板列表，并保留套用、报告模板、编辑和删除能力。
- 编辑器使用单边界诊断摘要和连续题目画布；AI 建议必须预览并确认后才应用。
- 既有问卷 AI 变更只应用勾选项，应用完成后清空变更集，不能重复应用。
- 小屏编辑器改为单列，AI 助手在主内容后完整显示，不再形成右侧窄列或横向溢出。

## 验证

- `pnpm --filter @repo/web run typecheck`: PASS
- `bash apps/web/scripts/lint-design.sh`: PASS（仅既有 `LABEL-LANG-MIX` 非阻断警告）
- `E2E_PORT=62730 COLLAB_WS_PORT=62731 pnpm exec playwright test e2e/survey-p25-008-source-stash-ui.spec.ts e2e/survey-p25-011-qwen-ai-workflow.spec.ts --reporter=dot`: 10 passed
- `E2E_PORT=62750 COLLAB_WS_PORT=62751 pnpm exec playwright test e2e/survey-p25-008-source-stash-ui.spec.ts --grep 'unified survey editor' --reporter=dot`: 1 passed
- 最终审查修复后，p25-001/008/011/012 四个 spec: 22 passed。
- p25-002 公开答题与专业 UI: 匿名移动端长问卷等 4 条通过；跨页面仪表盘测试增加首次编译预算后单独 1 passed。
- 独立 Task 3 reviewer 重跑聚焦 Playwright: 4 passed；Critical/Important/Minor 均为 0。
- `git diff --check`: PASS

## 截图

- `survey-unified-editor-desktop.png`
- `survey-unified-editor-mobile.png`

## 最终审查修复

- “报告模板”入口连接真实报告模板工作流，不再打开问卷题目模板编辑器。
- AI 对已有题目的追加不再依赖少量中文关键词，不会因“再来两题”或英文请求覆盖现有内容。
- 新建选择器桌面三列、移动单列；报告编排器移动端以预览优先排序。
- 公开答题页为移动端长问卷提供持续可达的提交操作，并通过匿名上下文验证。

## 状态边界

本轮只闭合统一创建界面和 AI 确认应用行为。F12 的真实答卷报告、零/低样本限制和失败重试仍未全部验收，因此 F12 保持 `in_progress`。

## 最终补充

- 上述 p25-011 mock 路由断言只证明浏览器中的预览、确认和应用 UI，不代表真实服务端、数据库或千问调用已经执行。
- 真实失败降级由 `Qwen fallback session remains recoverable and private to its actor` 覆盖，使用确定性模型 `qwen-force-fail` 验证持久化、actor 隔离和可恢复结果。
- F12 后续已通过完整 Harness 门控并由脚本转为 `passing`；最终状态与命令输出以 `F12.verify.log` 为准。
