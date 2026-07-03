# 进度日志 — Sprint p20/01

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: <feature id / title>
- 当前 blocker: <无 / 描述>

## 会话记录
### 2026-07-03 11:40:28
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-04 (wrk-room-2 / F07)
- 本轮目标: p20/F07 房间权限矩阵统一（API 断言 + 文档对齐），issue #300。
- 已完成:
  - PATCH /api/rooms/[id] 从仅 owner 放宽为 canManageRoom（owner∨admin）；DELETE 仍仅 owner。
  - PATCH /api/rooms/[id]/members/[userId]（提升/降级 admin）收紧为仅 owner。
  - members 页 UI 按角色收敛：角色下拉仅 owner 可见；admin 只对 member 行显示移除按钮。
  - 新增 e2e room-rr-007-permission-matrix.spec.ts（8 用例，矩阵每行正/反覆盖）。
  - 文档对齐：role-diagrams/room-{owner,admin,member}.md 重写（补 Survey/Files 节点，owner/admin 差异真实化）；phase-04 F12 user_visible_behavior 改为 owner/admin 口径（仅描述文字）。
- 运行过的验证: F07 三条 verification 全绿；回归 room-003/room-manage/room-rr-001 共 11 用例全过；design lint + tsc 过；pnpm harness verify --sprint p20/01 --feature F07 门控通过（F07=passing）。
- 已记录证据: evidence/F07.verify.log（gitignore 的 *.log，本地留存）。
- 已知风险或未解决问题: 矩阵「删除他人文件」行的 API 由 F03 交付，端点就绪后在 F03 e2e 断言（spec 内已注明）；房间删除入口 UI 目前不存在，无需隐藏。
- 下一步最佳动作: 等 PR review 合并；F03 交付文件库时按矩阵补删除他人文件断言。

### 2026-07-04 (wrk-room-2 / F07 review 返工)
- 本轮目标: PR #311 review 结论 CHANGES，逐项返工。
- 已完成:
  - 【阻断修复】证据入库：合入 coord/evidence-gitignore-exception（.gitignore 白名单 `!phases/**/evidence/*.log`）；F07 status 回退 in_progress + evidence 清空后重新 `pnpm harness verify --sprint p20/01 --feature F07` 门控转 passing，`evidence/F07.verify.log` 已被 git 跟踪进 commit。
  - 【矩阵缺口归属】uc-rr-006 矩阵中两行本 feature（F07）无法断言，归属如下：
    - 「admin 修改 AI 上下文字段」→ **归 F11**（rooms 表尚无 description/ai_instruction 字段，F11 回补时其 e2e 按矩阵断言 owner/admin ✅ / member 403）。F07 已把 PATCH /api/rooms/[id] 放宽为 canManageRoom，同端点未来字段自动继承该权限口径。
    - 「admin 删除他人文件」→ **归 F03**（房间文件端点尚未建，F03 交付 Files tab 时其 e2e 按矩阵断言 admin 可删他人文件 / member 仅本人）。
    - room-rr-007-permission-matrix.spec.ts 头部注释已同步注明缺口与归属。
  - 【建议项】e2e 的 `playwright: any` 改为 `PlaywrightWorkerArgs["playwright"]` 精确类型；spec 头部补 F07 / uc-rr-006 / rr-007 编号映射说明。
- 运行过的验证: `pnpm harness verify --sprint p20/01 --feature F07` 门控通过（F07=passing，含 verify:base）。
- 已记录证据: evidence/F07.verify.log（已入库，git 跟踪）。
