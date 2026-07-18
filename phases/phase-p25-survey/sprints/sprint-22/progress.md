# 进度日志 — Sprint p25/22

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/p25-f16-survey-report-fact-base`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F22 / 收敛分析报告为单列阅读页
- 当前 blocker: 无

## 会话记录
### 2026-07-19
- 本轮目标: 分析报告只保留根据报告模板组装的中间阅读区域，移除左侧章节与右侧 AI 助手。
- 已完成:
  - 历史与模板驱动专业报告统一使用单列阅读工作台。
  - 移除报告目录、移动端章节选择器和报告 AI 面板。
  - 删除分析报告入口对旧 `/ai-report` GET 接口的请求。
  - 保留版本历史、重新生成、分享、PDF 与 Word 操作。
- 运行过的验证:
  - `pnpm --filter @repo/web run lint`
  - `pnpm --filter @repo/web run typecheck`
  - F19、F21、F22 Playwright 联合回归，3 条全部通过。
- 已记录证据:
  - `evidence/report-single-column-desktop.png`
  - `evidence/report-single-column-mobile.png`
- 提交记录: 待提交。
- 已知风险或未解决问题: 无答卷时仍不生成分析结论，这是既有数据完整性约束。
- 下一步最佳动作: 提交实现后运行 `pnpm harness verify --sprint p25/22 --feature F22`。
