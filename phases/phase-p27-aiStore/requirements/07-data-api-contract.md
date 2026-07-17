# 数据、API、迁移与并发契约

## Resource

| 字段 | 规则 |
| --- | --- |
| `itemId` | 唯一且编辑/迁移时不变 |
| `type` | `agent | skill | template` |
| `skillKind` | Skill 必填，`text | image`；其他类型为空 |
| `originTeamId` | 非空、创建时可信写入、普通编辑不可变 |
| `createdBy` | 原始所有者，接受分享不可改变 |
| `name` / `description` | 必填 |
| `icon` / `cover` / `tags` / `examples` | 展示、搜索和详情配置 |
| `visibility` | `private | team | boardx` |
| `teamStatus` | `draft | pending | published | rejected` |
| `boardxStatus` | `not_submitted | pending | approved | rejected` |
| `teamFeatured` / `boardxFeatured` | 对应发布域独立控制 |
| `allowCopy` | 所有者控制，默认 `false` |
| `version` | 从 1 开始，有效内容修改后递增 |
| `copiedFromItemId` / `copiedFromVersion` | 副本来源，可空 |
| `archivedAt` | 软删除时间，可空 |
| `createdAt` / `updatedAt` | 创建与最近更新时间 |

## Subscription

| 字段 | 规则 |
| --- | --- |
| `itemId` | 指向源资源 |
| `subscriptionType` | `USER | TEAM` |
| `consumerTeamId` | 非空，来自可信当前 Team |
| `subscribedByUserId` | 发起操作的人 |
| `subscriberUserId` | USER 必填，TEAM 为空 |
| `createdAt` | 订阅时间 |

唯一约束：

- USER: `itemId + consumerTeamId + subscriberUserId + USER`
- TEAM: `itemId + consumerTeamId + TEAM`

USER/TEAM 订阅不保存资源版本，读取和执行始终解析源资源最新版本。

## EditAuthorization

| 字段 | 规则 |
| --- | --- |
| `itemId` | 原资源 |
| `ownerUserId` | 资源所有者 |
| `granteeUserId` | 接受者 |
| `originTeamId` | 来源 Team，不被接受者当前 Team 覆盖 |
| `permissions` | 本阶段固定 `edit` |
| `status` | `LINK | ACCEPTED | REVOKED` |
| `acceptedAt` / `revokedAt` | 审计时间 |

## RevisionAudit

`itemId`、`version`、`action`、`actorUserId`、`actorTeamId`、`changedFields`、`createdAt` 必填。状态操作与资源修改必须在同一事务边界内记录。

## Trusted Team context

- API 从认证会话、当前 Team cookie/session 和服务端 membership 解析 `currentTeamId`、角色。
- 请求 body/query 中的 `originTeamId`、`consumerTeamId`、角色只可作为不可信输入，不能覆盖服务端上下文。
- BoardX Admin 权限由平台身份系统判断，不能由 Team admin 推导。
- Authorized edit 是显式授权检查，不伪装成来源 Team membership。

## API 规则

- 列表支持关键词、类型、标签、Featured、分页，并返回稳定 cursor/page 终态。
- Detail 在成功读取时原子增加或异步可靠增加 view count；重试策略不能无限重复计数。
- Create 强制当前 Team、初始 draft/not_submitted/version=1。
- Update 要求 `expectedVersion`；成功递增版本并返回新版本。
- Archive、审核、Featured、订阅、分享、复制均使用独立动作端点，禁止通过通用 PATCH 绕过权限。
- USER/TEAM subscription authorization 必须服务端校验角色和当前 Team。
- Use 端点必须同时验证资源可用状态、当前 Team membership 和 USER/TEAM 订阅。
- 响应使用规范 `type=skill`、`skillKind` 和 `originTeamId`。

## 错误语义

- `400`: 参数、类型、`skillKind`、缺少当前 Team、非法 idempotency key。
- `403`: 已知动作权限不足，如普通成员 TEAM 订阅、`allowCopy=false`、被撤销编辑者保存。
- `404`: 资源不存在，或为防跨 Team 枚举而隐藏的管理对象。
- `409`: 非法生命周期转换、`expectedVersion` 冲突、不可订阅的当前状态。
- `410`: 分享 token 已关闭/撤销，或已知订阅指向归档/撤回的不可用资源。

错误响应包含稳定 `code`、用户可读 `message` 和可选 `details`，客户端不得依赖自由文本判断。

## 幂等与并发

- USER/TEAM subscribe、unsubscribe、favorite、unfavorite、accept share、revoke、archive 使用自然唯一键实现幂等。
- Copy 和可能产生新对象的命令接受 idempotency key。
- Update 使用乐观版本冲突，禁止 last-write-wins 静默覆盖。
- approved 内容更新与 RevisionAudit 原子提交；订阅者下一次读取立即看到新版本。

## 迁移

- `ai-tool|AI_TOOL -> skill + text`，`image-tool|AI_IMAGE_TOOL -> skill + image`。
- 旧记录原位更新，保持 `itemId` 和所有关系。
- 可空 `team_id` 迁移为非空 `originTeamId`；只能由唯一可信关系回填。
- 旧订阅补齐 `consumerTeamId`；无法唯一确定的资源/关系进入隔离审计表。
- 迁移先 dry-run 输出总数、可迁移数、冲突数和样例，再 apply。
- apply 可重复执行且结果一致；冲突记录不能进入 Explore、订阅或执行。
- 兼容窗口内输入可接受旧类型别名，输出始终规范化；窗口结束由独立后续决策移除输入别名。
