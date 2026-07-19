# F21 模板驱动报告入口修复

## 问题

用户从问卷设计器点击“分析报告”后被带到旧的
`/surveys/<id>/results` 页面。该页面调用旧 `/ai-report` 接口，
绕过已保存的报告模板和 `/professional-report` 生成流程；本地未配置真实
Qwen 上游时会显示 `ai_report_failed`。

## 用户可见行为

- 从问卷设计器点击“分析报告”后进入
  `/surveys?survey=<id>&step=report`。
- 页面显示模板驱动的专业报告工作台，使用问卷已保存的报告模板。
- 用户在该工作台主动生成报告时调用 `/professional-report`，不再经过旧
  `/ai-report`。
- 入口页面不再出现旧“生成 AI 报告”按钮或 `ai_report_failed`。
- 旧结果页仍作为独立的答卷统计与洞察入口保留，不在本 feature 删除。

## 验收

- Playwright 从已有问卷设计器点击“分析报告”，断言 URL、专业报告工作台和
  模板章节均正确。
- 监听网络请求，断言生成动作调用 `/professional-report`，未调用
  `/ai-report`。
- 生成成功后显示模板驱动报告文档。
