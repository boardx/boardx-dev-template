Use Case 名称：
邀请未注册用户加入房间（完整流）

Actor：
Room owner、Room admin（邀请方）；未注册用户（被邀方）

目标：
补齐现状半成品（生成 token 但不持久化、不发邮件）：对未注册邮箱发出可用的邀请，被邀者注册后
自动成为房间成员（对齐旧后端 `inviteNewUserToRoomByEmail` + 邮件流）。

系统边界：
BoardX / Room + Auth（复用 phase-04 dev 邮件通道：控制台日志 + DB 令牌）

前端入口：
房间 Members tab 的邀请输入框（现有 UI，行为补全）。

前置条件：
- 邀请方是房间 owner/admin。

主流程：
1. 邀请方输入邮箱提交；系统先查该邮箱是否已注册（沿用现有逻辑）。
2. 已注册 → 直接加为 member（现状已支持，保留）。
3. 未注册 → 生成邀请令牌**持久化**（room_invites 表：email、room_id、role=member、token、
   expires_at、invited_by），并经 dev 邮件通道发送包含注册链接的邀请（真 SMTP 待接，同 auth 现状）。
4. 被邀者通过链接注册；注册成功后系统按未过期邀请自动写入 room_members，登录即见该房间。
5. 邀请方在 Members tab 看到 pending 邀请列表，可撤销（删除令牌）。

异常流程：
- E1：令牌过期（默认 7 天）→ 注册仍成功但不入房，提示邀请已过期。
- E2：重复邀请同一邮箱 → 幂等刷新令牌与过期时间，不产生重复记录。
- E3：member 尝试邀请 → 403。

后置条件：
- 邀请全程可追溯（谁邀的、何时、状态 pending/accepted/revoked/expired）。

不包含：
- 真实 SMTP/Resend 接入（沿用 phase-04 的 dev 邮件边界）。
- 邀请链接直达「加入房间」页（本期只做注册即入房）。

业务规则：
- 同一邮箱可同时存在多个不同房间的邀请。
- pending 列表带 `data-testid=room-invite-pending`。
