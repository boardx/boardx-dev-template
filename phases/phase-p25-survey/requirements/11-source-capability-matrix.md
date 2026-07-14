# boardx-survey 源能力与 p25 重建矩阵

## 1. 权威源快照

- 源仓库：`/Users/shenyangjun/boardx/boardx-survey`
- 分支：`codex-survey-home-nav-redesign`
- 分支 HEAD：`0ae3af90c989843025fb2a60aacf90de6ed8df11`
- 未提交工作快照：`stash@{0}` = `e9da40f6c2e7cda91d5cc165e98dd438b8d0e8e3`
- stash tree：`1eb9d7ba78cdda3d1a66fecb7d9fc2b7678cc64c`

本阶段的产品事实来源是“分支 HEAD + stash 工作快照”。只读取 HEAD 不满足“包括未提交内容”的同步要求。

关键文件内容哈希：

| 文件 | stash SHA-1 |
| --- | --- |
| `apps/web/app/(app)/surveys/page.tsx` | `f40dba40f600d67d98ef077c67eb91e8a13dc86c` |
| `apps/web/app/(app)/surveys/[id]/results/page.tsx` | `766da8f0da6b7c48f58074aaa5b54bcaa564a08b` |
| `packages/data/src/survey.ts` | `034ca4f52d047b92d06a0c41093ef24eb8948873` |
| `packages/data/src/surveyAi.ts` | `e4657b106cc54ca60b51aed3ff3d200d3d5b67d0` |

## 2. 同步原则

1. 以源 stash 的用户可见行为和测试为基准重新实现，不机械覆盖主仓文件。
2. 保留主仓已有的 Room scope、Team/owner 鉴权、公开答题边界和迁移历史。
3. AI 模型统一走主仓 `packages/ai` 的千问 provider；源仓多模型选项转换为千问模型/确定性测试 stub，不恢复 OpenAI、Gemini 或 MiniMax。
4. 不同步 `.next*`、缓存、生成 bundle、整仓 auth/team 脚手架等非 Survey 产物。
5. 历史 F01-F08 已 passing，不修改其状态；新增纠偏能力使用 F09 以后 feature 表达。

## 3. 能力矩阵

| 能力 | 源 stash 实现 | 当前主仓状态 | 重建归属 |
| --- | --- | --- | --- |
| BoardX Survey 首页、我的问卷、模板导航 | `surveys/page.tsx` WorkspaceShell | F08 已同步基础壳层 | F10 补齐完整工作流 |
| 问卷模板管理、标签、删除、应用 | 页面 + `survey-templates/[id]` | 基础模板可用，标签/完整编辑行为不全 | F09/F10 |
| 全题型编辑、题目分类、报告规划联动 | 页面 + question category migration | 基础题型可用，分类/规划链不完整 | F09/F10 |
| AI 引导创建与变更集确认 | `surveys/ai` + sessions + events | 千问草稿/恢复可用，事件流和完整变更集不足 | F11 |
| 发布回收与公开答题 | publish settings + answer | 已有主仓增强实现 | F10 回归，不覆盖 |
| 报告模板持久化 | `report-template` route | 缺少对应 route | F09/F12 |
| 分类报告编排 | `report-categories` + category-plan lib | 缺少 route/lib | F09/F12 |
| 动态报告规划与低样本约束 | `survey-report-planner` | 缺少 planner | F12 |
| 结果页、专业图表和真实数据报告 | results page + ECharts | 仅基础 SVG 统计 | F12/F13 |
| Word/PDF/PNG/可视化导出 | `report-export` | CSV + browser print | F13 |
| 报告图片生成与失败降级 | `wan-image` | 未实现 | F13 |
| 全链路 source E2E | survey-001 至 survey-015 | p25 仅覆盖基础闭环 | F14 |

## 4. 明确排除

- 源 stash 中 `.next-e2e-*`、cache、bundle 和类型生成物。
- 与 Survey 无关的 auth、team、account、agent 配置和整仓基础设施复制。
- 绕过主仓权限模型或直接替换既有 migration。
- 非千问生产模型 provider。

## 5. 完成标准

- F09-F14 全部由 `pnpm harness verify` 升级为 passing。
- 源 stash 的 Survey 用户旅程在主仓可运行，并由新的 p25 E2E 逐项证明。
- `pnpm harness doctor --phase p25` 为 0 FAIL / 0 WARN。
- PR 中提交每个 feature 的真实 evidence、progress 和 handoff。
