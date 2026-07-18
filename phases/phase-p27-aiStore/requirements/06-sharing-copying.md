# 编辑分享与独立复制

## Edit share

- 分享对象是原 `itemId`，接受者编辑原资源，不创建副本。
- 接受分享不改变 `createdBy` 或 `originTeamId`。
- 所有者控制链接创建/关闭、用户撤销、生命周期、`allowCopy` 和 archive。
- 分享权限本阶段固定为 `edit`。
- 授权状态为 `LINK | ACCEPTED | REVOKED`。
- 接受者可跨 Team 编辑内容字段，不需要加入来源 Team。
- 接受者不能修改所有者、来源 Team、Team/BoardX 状态、Featured、`allowCopy` 或分享授权。
- 接受者不能删除/归档，也不能继续分享给他人。

## 分享流程

1. 所有者创建 management-share link，服务端生成不可猜测 token。
2. 接收者读取 info 时只能获得接受决策所需的最小信息。
3. 接收者接受后建立 `EditAuthorization`，重复接受同一有效授权幂等。
4. Authorized 按当前用户聚合全部有效授权，并显示来源 Team。
5. 所有者可查看 access list，关闭链接或撤销单个用户。
6. 关闭链接使 token 返回 410，并撤销该链接产生的尚有效授权。
7. 撤销立即生效；被撤销用户下一次保存返回 403。

## Copy

- 非所有者复制要求 `allowCopy=true`。
- 复制创建新 `itemId`，不编辑原资源。
- 副本写入当前 Team: `originTeamId=currentTeamId`、`createdBy=currentUserId`。
- 副本初始为 `visibility=private`、`teamStatus=draft`、`boardxStatus=not_submitted`、`featured=false`。
- 副本记录 `copiedFromItemId` 和 `copiedFromVersion`。
- 副本不继承订阅、收藏、likes/views、审核、Featured、分享 token 或编辑授权。
- Agent/Skill 深拷贝配置；后续与原资源双向独立。
- Template 必须把 Board 内容深拷贝到目标 Team，不能继续绑定来源 Team 的可编辑 Board。
- 原资源后续修改或关闭 `allowCopy` 不影响已经创建的副本。

## 权限和错误

- 不可见资源不能复制，即使调用方知道 `itemId`。
- `allowCopy=false` 返回 403。
- 无当前 Team 返回 400；当前 Team membership 失效返回 403。
- 原资源归档或撤回可用状态返回 410。
- Template Board 深拷贝失败时整个复制事务回滚，不留下半成品资源。
- 客户端提供 idempotency key；同一用户、Team、来源 item/version 和 key 的重试返回同一副本。

## 区分订阅、分享和复制

| 行为 | 指向原资源 | 跟随最新版 | 获得编辑权 | 创建新归属 |
| --- | --- | --- | --- | --- |
| USER/TEAM 订阅 | 是 | 是 | 否 | 否 |
| Edit share | 是 | 是，因直接编辑原资源 | 是，限内容字段 | 否 |
| Copy | 否，创建新 item | 否 | 是，作为新所有者 | 是，当前 Team |
