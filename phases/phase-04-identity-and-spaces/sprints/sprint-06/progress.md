# 进度日志 — Sprint 04/06

## 当前已验证状态(唯一真相)
- 仓库根目录: worktree coord-platform-p2-f03（基于 origin/main 5029dc3）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无（本 sprint 唯一 feature F13 已 passing）
- 当前 blocker: 无

## 会话记录
### 2026-07-14
- 本轮目标: 收口 #600 第 5 项——04-F13 团队 Memory（uc-team-009）。
- 评估结论（issue 要求先评估 packages/memory 复用）: packages/memory 是 agent 运行时的
  文件级三层记忆抽象（Working/Session/Durable，node fs 持久化），单进程单用户语义，
  不适配多用户团队场景（需 DB、多租户、权限），**不直接复用**；概念对齐（durable 文本条目）
  但落地为独立 team_memories 表。体量适中，未拆解，直接实现。
- 已完成:
  - 迁移 `036_team_memories.sql`（team_id+content 唯一约束兜底去重）+
    `packages/data/src/teamMemories.ts`（list/add/delete，add 用 ON CONFLICT DO NOTHING）。
  - API `/api/teams/[id]/memories`（GET/POST，owner/admin 门槛，重复 409）+
    `/[memoryId]`（DELETE）。
  - 页面 `/teams/[id]/memory`：搜索过滤（保留 总数/过滤数）、Enter 新增（Shift+Enter 换行）、
    空内容禁用、重复提示已存在、删除确认弹窗、失败回退+提示；团队 Home 加 entry-memory 卡片；
    非 owner/admin 无权限态。
- 运行过的验证: 新 e2e team-013-memory.spec.ts 3/3；team-016 回归通过；
  `pnpm harness verify --sprint 04/06` 门控通过 → F13 passing（首轮被 design lint 拦：
  hover 无 transition + 裸 outline-none，已修复）。
- 已记录证据: `evidence/F13.verify.log`
- 提交记录: 分支 coord-platform/p2-f03-home-agent-filter
- 已知风险或未解决问题: AI 对话尚未消费团队 Memory（uc-team-009 明确"不包含 AI 如何使用
  Memory"）；接入点建议在 AVA capabilities/system prompt 组装处，另立 feature。
- 下一步最佳动作: #600 五项全部收口，转 #602（p17-F06 KB+Credits reskin）。
