# 进度日志 — Sprint p2/03

## 当前已验证状态(唯一真相)
- 仓库根目录: worktree coord-platform-p2-f03（基于 origin/main 5029dc3）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无（本 sprint 唯一 feature F06 已 passing）
- 当前 blocker: 无

## 会话记录
### 2026-07-14
- 本轮目标: 收口 #600 第 2 项——p2-F06 Agent 快捷对话 / 继续上次对话 / 推荐功能启动。
- 已完成:
  - `/ava` 新增深链支持：`?threadId=N` 挂载时直接打开该线程；`?mode=research&researchType=market|user-research` 预置 composer 研究模式与类型。
  - Home（home-workbench）：Agent 卡片「Quick chat」创建线程、按 agent 命名（`Chat with <name>`）、跳 `/ava?threadId&agentItemId`（复用 uc-ai-store-003 的 composer 预填）；欢迎区「Continue last conversation」在有线程时出现并跳回最近线程；推荐启动器 用户研究/深度研究/实时转录 分别建命名线程并带对应 researchType 跳转；创建中按钮 disabled 防重复点击，失败停留 Home 显示 `launch-error` 可重试。
  - 说明：线程表无 agent/model/research_type 列（p9 现状），「写研究类型」由 URL 参数驱动 composer 预置 + 首次研究会话持久化（p18-F14 机制）承接；「实时转录」现无独立模式，落为命名线程 + composer 内 VoiceInputControl。
- 运行过的验证: 新 e2e home-quick-chat.spec.ts 5/5；home+ava 相关 19 条 e2e 回归通过；`tsc --noEmit`；`pnpm harness verify --sprint p2/03` 门控通过 → F06 passing。
- 已记录证据: `evidence/F06.verify.log`
- 提交记录: 分支 coord-platform/p2-f03-home-agent-filter（与 F03 同分支，PR 待人类放行）
- 已知风险或未解决问题: 无
- 下一步最佳动作: #600 第 3 项 04-F16（团队 Home 统计壳 + 团队 AI Store 入口）。
