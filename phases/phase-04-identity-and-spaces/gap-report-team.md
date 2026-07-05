# Team 域 Gap 调研报告（2026-07-05）

> 对照四方来源：oldcode（NestJS+Mongoose）、权威需求
> `phases/phase-04-identity-and-spaces/requirements/team/uc-team-001~010`、
> `feature_list.json`（area=="team"）、当前实现（apps/web+packages/auth+packages/data）。
> Platform/Accounts（coord-platform）立项前调研，仅调研不改代码。

## 结论

Team 核心域（001-006）已实现且大体符合需求，但存在一处**可越权的成员权限安全缺口**：
`apps/web/app/api/teams/[id]/members/[userId]/route.ts` 全文（1-41 行）改角色/移除成员
**只查操作者角色，不查目标角色**，与需求明文"owner 不可降级/移除"矛盾，room 域
（`apps/web/app/api/rooms/[id]/members/[userId]/route.ts:25,46`）已有对应保护，team 域没有跟进。
其次，F06-F09 标 passing 但 evidence 引用的 verify log 不存在（sprint-02/evidence 下只有空
`.gitkeep`），是证据链缺口而非功能造假——底层代码确由 commit `7e58dce` 落地。F13 的 deferred
理由（"依赖 AI/Memory 平面"）对 007/008/010 已不成立，只有 009（团队 Memory）真缺数据模型。

## 权限模型冲突（最关键）

`packages/auth/src/index.ts:95-97` 定义 `canManageTeam = owner∨admin`，但
`teams/[id]/members/[userId]/route.ts` PATCH（9-25行）与 DELETE（27-40行）均只用
`canManageTeam(操作者角色)` 校验，**不检查 `params.userId` 对应角色**。
`packages/data/src/teams.ts` 的 `updateMemberRole`（78-80行）、`removeMember`（82-84行）
也是裸 UPDATE/DELETE，数据层同样无保护。后果：任何 admin 可把 owner 降级或移除出团队，
直接违反 uc-team-005（`ownerNotRoleChange`/`ownerNotRemovableTeam`）。
`teams/[id]/invites/route.ts:18` 的 `isTeamRole()` 校验也未禁止 admin 生成 `role:"owner"`
的邀请链接，可绕过上述缺口另造一个 owner。room 域（p20-F07 权限矩阵统一后）已实现
"不能改/移除 owner""admin 不能互删 admin"，team 域是更早期实现，两域规则不一致，
建议收敛到同一权限校验层。

## Evidence 真实性核查

F06-F09 status=passing，但 `sprint-02/evidence/` 仅一个 0 字节 `.gitkeep`，引用的
`evidence/F0{6-9}.verify.log` 均不存在；`sprint-02/progress.md` 为未填模板。底层功能真实
（`git log` 命中 `7e58dce feat(team): F06-F09 …全部 passing`，含 7 个路由+4 个 e2e+迁移），
但不满足 AGENTS.md"没有证据=没有完成"。F13 evidence 为空字符串与 status=not_started 一致，
但状态本身过时：commit `f603f45`（2026-07-01）已实现 uc-team-007 的团队改名/描述/删除
（General 设置）并配 2 个 e2e，`git show f603f45 -- feature_list.json` 为空，说明从未回写。

## Deferred 理由复核（uc-007~010）

四份 .md 正文均无 DEFERRED 措辞，判断只存在于 `feature_list.json:271` 的 notes。逐项核查：
CAP-AI 平面（`packages/ai/src/gateway.ts`+`graph.ts`）已被 p9-AVA（9/10 passing）消费，成立；
AI Store（uc-010）已有团队维度真实实现——`teams/[id]/ai-store-review/page.tsx`+对应 API，
p11 5/6 passing；007（改名/描述/删除）、008（Home 统计壳）与 AI/Memory 无强依赖，007 事实上
已单独实现。仅 009（团队 Memory）仍缺——`packages/memory` 是 harness 自身的
working/session/durable 会话记忆基础设施，apps/web 无任何 import，与"团队级可管理 Memory 列表"
无关，需另建 `team_memories` 表。**建议**：F13 拆分而非整体 deferred，并补写 007 的实际完成状态。

## 团队邀请 vs Room 邀请（p20-F09）结构对比

`003_team.sql`（18-25行）`team_invites`：token 作主键，无 email 字段、无 status 枚举、
无 invited_by、无索引。`025_room_invites.sql`：自增 id+token UNIQUE、`email`+
`UNIQUE(room_id,email)` 防重复、显式 `status` pending/accepted/revoked/expired、
`invited_by` 溯源、email/token 双索引。`createTeamInvite` 不持久化邮箱，
`TEAM_INVITE_TTL_MS`/`ROOM_INVITE_TTL_MS`（`packages/auth/src/index.ts:81-82`）字面量重复
但两套 CRUD 各自独立实现，未抽象 InviteService。room 表设计明显更完善，建议 team 表向其对齐。

## 测试覆盖缺口

已覆盖：创建/切换/邀请加入/角色管理/删除（`team-{create,switch,manage,invite-join,
003-invite-members,007-general-settings}.spec.ts`）、非法角色 403。
**缺口**：owner 不可移除/降级（正反向均无测试，对应实现缺口）、admin 不能互删、
邀请过期/重复消费（double-join）、admin 邀请 owner 角色的危险路径、
`apps/web/app/api/invite/[token]/route.ts`（STUB 死路由，硬编码 demo token）无测试且
未知是否仍被引用、`packages/data/src/teams.ts` 无独立单测。

## 建议

1. 立即修复越权缺口：members/[userId] 路由与 data 层加 target-owner 保护，对齐 room 域。
2. F06-F09 补齐 evidence 落盘；F13 拆分状态，007 回填为 passing。
3. team_invites 迁移向 room_invites 看齐（email 绑定+status 枚举），评估共享 InviteService。
4. 清理或确认下线 `/api/invite/[token]` STUB 路由。
