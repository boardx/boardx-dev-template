# 进度日志 — Sprint 04/04

## 当前已验证状态(唯一真相)
- 仓库根目录: worktree coord-platform-p2-f03（基于 origin/main 5029dc3）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无（本 sprint 唯一 feature F16 已 passing）
- 当前 blocker: 无

## 会话记录
### 2026-07-14
- 本轮目标: 收口 #600 第 3 项——04-F16 团队 Home 统计壳 + 团队 AI Store 入口。
- 已完成:
  - 新页面 `/teams/[id]`（团队 Home）：四张 Dashboard 统计卡片（Active Members=成员列表计数、
    AI Tools=team-scope Store 项目计数、Pending Reviews=待审队列计数、Total Tokens=团队钱包
    total_consumed，无权限项显示 —）；管理入口卡片（General/Members/Credits/Knowledge/Surveys）；
    AI Store 分组（Store Explore → /ai-store、Store Subscribe → /ai-store?nav=subscribe、
    Store Approval → /teams/[id]/ai-store-review），统计与入口都以当前团队为上下文；
    非成员显示无权限态。
  - `/teams` 列表给 owner/admin 加 `manage-<id>` 入口按钮。
  - store-browser 深链扩展：`?nav=subscribe` 直达订阅视图（原来只支持 authorized）。
  - F16 的占位 verification（恒 false）替换为真实 e2e：`e2e/team-016-home-dashboard.spec.ts`。
- 运行过的验证: 新 e2e 3/3；team-manage/create/switch + ai-store-003 共 12 条回归通过；
  `tsc --noEmit`；`pnpm harness verify --sprint 04/04` 门控通过 → F16 passing。
- 已记录证据: `evidence/F16.verify.log`
- 提交记录: 分支 coord-platform/p2-f03-home-agent-filter
- 已知风险或未解决问题: Total Tokens 现取 credit 钱包 total_consumed（尚未接 AI 用量扣费），
  是"统计壳"口径；接真实 token 计量时只需换数据源。
- 下一步最佳动作: #600 第 4 项 04-F14（房间文件/Studio/问卷 团队视角链接）。
