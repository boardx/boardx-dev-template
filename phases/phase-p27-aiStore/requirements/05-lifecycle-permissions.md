# 生命周期、权限与审计

## 状态模型

```text
teamStatus: draft | pending | published | rejected
boardxStatus: not_submitted | pending | approved | rejected
```

归档由 `archivedAt` 表达，是所有发布状态之上的不可用条件。

## Team 状态转换

- 创建: `draft`。
- 所有者提交: `draft|rejected -> pending`。
- 来源 Team owner/admin 批准: `pending -> published`。
- 来源 Team owner/admin 拒绝: `pending -> rejected`。
- 来源 Team owner/admin 撤回: `published -> pending`。
- published 资源内容编辑保持 `published`，新版本立即生效。
- 非法转换返回 409，不自动跳过中间状态。

## BoardX 状态转换

- 初始: `not_submitted`。
- 所有者或来源 Team owner/admin 提交: `not_submitted|rejected -> pending`。
- BoardX Admin 批准: `pending -> approved`。
- BoardX Admin 拒绝: `pending -> rejected`。
- BoardX Admin 撤回批准: `approved -> rejected`，并取消 BoardX Featured。
- 第一次进入 approved 必须经过 BoardX Admin 审核。
- approved 资源内容编辑保持 `approved`，不重新审核，所有订阅者立即解析新版本。

## 角色/动作矩阵

| 动作 | 普通成员 | Team owner/admin | 资源所有者 | Authorized editor | BoardX Admin |
| --- | --- | --- | --- | --- | --- |
| 查看 approved BoardX 资源 | 是 | 是 | 是 | 是 | 是 |
| 创建当前 Team 资源 | 是 | 是 | 是 | 否 | 按其 Team 角色 |
| 编辑内容 | 自有资源 | 自有/有权限资源 | 是 | 是 | 否，除非另有 edit 权限 |
| 改 `originTeamId`/`createdBy` | 否 | 否 | 否 | 否 | 否 |
| 提交 Team 审核 | 自有资源 | 是 | 是 | 否 | 否 |
| Team approve/reject/withdraw/featured | 否 | 仅来源 Team | 仅同时为管理员 | 否 | 否 |
| 提交 BoardX 审核 | 否，除非所有者 | 是，仅来源 Team | 是 | 否 | 否 |
| BoardX approve/reject/revoke/featured | 否 | 否 | 否 | 否 | 是 |
| 创建/取消自己的 USER 订阅 | 是 | 是 | 是 | 是 | 是 |
| 创建/取消 TEAM 订阅 | 否 | 仅当前 Team | 仅同时为管理员 | 否 | 按其 Team 角色 |
| 创建/管理编辑分享 | 否，除非所有者 | 否，除非所有者 | 是 | 否 | 否 |
| 修改 `allowCopy` | 否 | 否，除非所有者 | 是 | 否 | 否 |
| 复制允许复制的可见资源 | 是 | 是 | 是 | 是 | 是 |
| Archive | 否 | 否，除非所有者 | 是 | 否 | 否 |

## 可见、订阅与使用

- approved BoardX 资源对所有认证用户可见。
- 可见不等于可使用；跨 Team 使用要求当前 Team 下存在该用户的 USER 订阅或 TEAM 订阅。
- BoardX 撤回 approved 后，其他 Team 不能新订阅或新执行；已有订阅保留但显示不可用。
- 来源 Team 对自有资源的管理权限不由消费订阅决定。

## Featured

- Team Featured 仅适用于当前来源 Team 的 `teamStatus=published`、未归档资源。
- BoardX Featured 仅适用于 `boardxStatus=approved`、未归档资源。
- 撤回相应发布状态时自动清除对应 Featured。
- Team Featured 与 BoardX Featured 是两个独立维度。

## RevisionAudit

创建、内容编辑、提交、批准、拒绝、撤回、Featured、订阅、取消订阅、分享、接受、撤销、复制和归档均记录：

- `itemId`
- `version`
- `action`
- `actorUserId`
- `actorTeamId`
- `changedFields`
- `createdAt`

审计必须能回答谁在什么时间以哪个 Team 身份改变了哪个版本和字段。内容编辑审计成功写入后不额外等待人工审核；审计写入失败必须使同一事务失败，不能出现无审计的成功状态变更。
