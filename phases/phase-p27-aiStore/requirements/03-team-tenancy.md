# AI Store Team 租户契约

## 四个不同概念

- `originTeamId`: 资源的不可变来源 Team，创建时由可信当前 Team 写入。
- `consumerTeamId`: 订阅和使用发生的 Team，可与来源 Team 不同。
- USER 订阅: 属于一个用户在一个 Team 的个人消费关系。
- TEAM 订阅: 属于一个 Team，全体成员可在该 Team 使用。
- Authorized: 跨 Team 编辑能力，不是 Team membership，不产生订阅或管理角色。

## 资源归属与可见性

- Agent、Skill、Template 每条记录必须有非空 `originTeamId`。
- `visibility=private|team|boardx` 只表达可见性，不能替代 Team 归属。
- private 资源属于“当前用户 + 来源 Team”；切换 Team 后不可见。
- team 资源只按来源 Team 和 Team 发布状态可见。
- BoardX approved 资源对所有已登录用户可见，并展示来源 Team。
- 跨 Team 可见不会授予编辑、分享管理、发布管理、精选、归档或删除权限。
- 同名资源可在不同 Team 独立存在，配置、状态、版本、统计和关系不串联。

## 可信 Team 上下文

- 服务端从已认证会话解析当前 Team 和角色，忽略 body/query 中伪造的归属 Team。
- 创建资源和副本时由服务端写入当前 Team。
- USER/TEAM 订阅均强制保存当前 `consumerTeamId`。
- 管理类请求必须同时验证用户身份、当前 Team、资源来源和角色。
- 防枚举场景可返回 404；已知资源但权限不足的明确操作返回 403。
- 所有缓存 key、列表状态、选择器和乐观更新都包含当前 Team；切换 Team 清空旧状态并重新加载。

## 订阅权限

- 普通成员可创建和取消自己的 USER 订阅，不能为其他用户订阅。
- Team owner/admin 可创建和取消当前 Team 的 TEAM 订阅。
- Team owner/admin 也可选择创建自己的 USER 订阅。
- 普通成员请求 TEAM 订阅返回 403。
- USER 订阅只允许该用户在该 `consumerTeamId` 使用。
- TEAM 订阅允许该 `consumerTeamId` 的当前成员使用。
- Team B 对 Team A 的 approved 资源订阅后，源资源仍是 `originTeamId=Team A`，消费关系为 `consumerTeamId=Team B`。
- 订阅不授予任何源资源编辑或生命周期权限。

## Authorized 例外

- Authorized 按用户列出其接受的全部有效编辑授权，可包含其他来源 Team。
- 被授权者无需成为 `originTeamId` 的成员，但页面必须显示来源 Team。
- 被授权者只能编辑允许的内容字段；不能改变来源 Team、所有者、审核/精选状态、`allowCopy`、分享授权或归档状态。
- 接受授权不得改写 `createdBy`，也不得创建隐式 Team membership。

## 历史数据迁移

- 已有非空 Team 关系原样保留并映射为 `originTeamId`。
- 能从唯一可信关系确定来源 Team的记录可原位回填。
- 无法唯一确定来源 Team 的记录不得猜测；进入可审计隔离清单，禁止管理、订阅和执行。
- 旧可空订阅必须补齐 `consumerTeamId`；无法唯一确定的关系进入隔离清单。
- 迁移幂等，不复制资源，不破坏现有关联。

## 可观察验收

1. Team A 与 Team B 可创建同名资源，各自管理列表只显示正确实例。
2. 所有用户可看到 Team A 的 approved BoardX 资源及来源 Team。
3. Team B 未订阅时可查看但不能使用；USER 或 TEAM 订阅后按范围使用最新版。
4. 普通成员的 TEAM 订阅请求返回 403。
5. 切换 Team 后 Explore 私有部分、Subscribe、Create、Shared 和 AVA 选择器无旧 Team 残留。
6. Authorized 可跨 Team 编辑原资源，但所有权、来源 Team 和管理动作保持不变。
