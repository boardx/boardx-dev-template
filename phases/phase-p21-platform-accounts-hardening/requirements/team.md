# 原始需求 — Team 域越权修复（Phase p21）

## 背景 / 为什么做
`apps/web/app/api/teams/[id]/members/[userId]/route.ts` 的 PATCH（改角色）和 DELETE（移除成员）
只用 `canManageTeam(操作者角色)` 校验"操作者能不能动手"，从不检查 `params.userId` 对应的人是不是
owner。`packages/data/src/teams.ts` 的 `updateMemberRole`/`removeMember` 数据层同样没有保护。
后果：**任何 admin 都可以把 owner 降级为普通成员或直接移除出团队**，直接违反
`uc-team-005-manage-members.md` 明文要求的"owner 不可被降级/移除"规则。更进一步，
`teams/[id]/invites/route.ts` 的角色校验也没有禁止 admin 生成 `role:"owner"` 的邀请链接，
理论上可以绕开前一个缺口，另外邀请一个人接受后成为新 owner，构成完整的团队接管路径。
room 域（p20-F07 权限矩阵统一后）已经实现了"不能改/移除 owner""admin 不能互删 admin"，
team 域是更早期的实现，从未跟进同一套保护。

## 原始需求（用户故事 / 大白话都行）
- 作为团队 owner，我想要没有任何 admin 能把我降级或移除出我自己创建的团队，以便团队所有权
  不会被恶意或误操作的管理员篡夺。
- 作为团队 owner，我想要 admin 不能签发一个"角色=owner"的邀请链接，以便不存在绕过"owner 不可
  被移除"规则、另造一个 owner 来变相接管团队的路径。
- 作为安全审计者，我想要 team 域的权限校验规则和 room 域保持一致（同一套"谁能对谁做什么"的
  判断逻辑），而不是两个域各写一套、行为不同步。

## 验收线索（可观察的成功是什么样）
- 以 admin 身份调用"修改成员角色"接口，目标是团队 owner 时，请求被拒绝（如 403），owner 的
  角色不发生任何变化；同样，以 admin 身份调用"移除成员"接口移除 owner 时也被拒绝。
- 以 admin 身份创建团队邀请时，若尝试指定角色为 owner，请求被拒绝或角色被强制降级为非 owner；
  已存在的合法邀请流程（邀请 member/admin）不受影响。
- 补充的 e2e/单测能覆盖"admin 尝试降级/移除 owner 被拒绝""admin 尝试签发 owner 邀请被拒绝"这两
  个此前完全没有测试覆盖的路径。

## 范围与边界
- 本阶段要做：members/[userId] 路由 + `packages/data/src/teams.ts` 数据层加 target-owner 保护；
  invites 路由禁止签发 owner 角色邀请；补齐 F06-F09 的 verify 证据（底层代码已真实存在，只是
  证据文件缺失，重新跑一遍验证落盘即可）；F13 状态拆分（uc-007 团队改名/描述/删除已经在
  commit `f603f45` 实现却从未回写 feature_list.json，本阶段把它回填为 passing；uc-008/010
  依赖的 AI/AI Store 平面已 passing，评估是否也能解除 deferred；uc-009 团队 Memory 仍缺数据
  模型，继续 deferred）。
- 明确不做：`team_invites` 表结构向 `room_invites` 看齐（无 email 绑定/无 status 枚举/无索引，
  是真实技术债但不是安全漏洞，不阻塞本阶段主线，可独立立项）；`/api/invite/[token]` 这个
  STUB 死路由的清理（先确认是否仍被引用，若确认死代码可顺手删，不需要单独开 feature）。

## 已知约束 / 依赖
- 依赖的能力平面：CAP-AUTH/CAP-DATA。
- 权限修复必须过 rev-security 审查（`auth`/`team` 都在 registry.yaml 的 rev-security
  required_for 列表里）。
- 参考 room 域已有实现（`apps/web/app/api/rooms/[id]/members/[userId]/route.ts` 的
  target-owner 保护写法）作为对齐样板，不需要重新发明一套判断逻辑。

## 切分提示（给 requirement-author 的建议）
- 建议一个 feature 覆盖"越权修复（members 路由+data 层+invites 路由）+ 补齐对应 e2e"，这是
  wave 0、最高优先级、必须过 rev-security。
- 另一个 feature 覆盖"F06-F09 证据补齐 + F13 状态拆分回填"，纯证据/状态维护类工作，优先级
  次之，不需要 rev-security（不改变行为，只是让状态诚实）。
