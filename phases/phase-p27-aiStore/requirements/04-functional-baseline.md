# AI Store 完整功能基线

## Navigation

- 触发: 已登录用户从全局侧栏进入 AI Store，并在 Explore、Subscribe、Create、Authorized、Shared 间切换。
- 可见结果: 当前视图和类型筛选稳定显示，刷新可恢复可分享的 URL 状态。
- 权限失败: 未登录跳转登录；无当前 Team 显示阻断错误，不回退到任意 Team。
- Team 行为: Explore/Subscribe/Create/Shared 随当前 Team 切换；Authorized 按用户跨 Team 聚合并标注来源 Team。
- 稳定状态: 导航加载失败显示重试；无数据不隐藏导航。

## Explore

- 触发: 用户搜索、分页或按 All/Agent/Skills/Template、标签、Featured 筛选。
- 可见结果: 展示当前 Team 自有可见资源和全部 BoardX approved 资源，卡片显示来源 Team、版本、喜欢数和 Featured。
- 权限失败: 未认证不可查看；归档、未 approved 的外部 Team 资源不可枚举。
- Team 行为: 切换 Team 后清空旧结果并重新加载；BoardX approved 公共结果仍保留来源 Team。
- 稳定状态: 有加载骨架、零结果空态、请求失败重试和明确分页终态。

## Detail

- 触发: 用户从列表或分享链接打开资源。
- 可见结果: 显示描述、示例、配置摘要、来源 Team、当前版本、统计以及收藏、订阅、使用、复制动作。
- 权限失败: 不可见返回 404；已撤回或归档资源对非管理者显示不可用而不泄露配置。
- Team 行为: 订阅/使用状态按当前 `consumerTeamId` 和当前用户计算。
- 稳定状态: 资源不存在、已归档和网络失败使用不同稳定状态。

## Create / Edit / Preview

- 触发: 创建者选择 Agent、Skill、Template；Skill 再选择 text/image，填写并预览后保存。
- 可见结果: 创建新 draft；编辑成功递增 version，approved/published 内容立即更新且不重新审核。
- 权限失败: 非所有者或无有效 edit 授权返回 403；伪造 `originTeamId` 被忽略。
- Team 行为: 新资源归当前 Team；Authorized 编辑跨 Team 修改原 `itemId`，不改变来源 Team。
- 稳定状态: 必填校验为 400；版本冲突为 409并提示刷新；预览失败不丢失表单。

## Archive

- 触发: 所有者确认归档。
- 可见结果: 设置 `archivedAt`，资源从 Explore、Create、Authorized 和新订阅入口移除。
- 权限失败: 非所有者包括授权编辑者返回 403。
- Team 行为: 只能由源资源所有者归档；其他 Team 订阅者不能操作。
- 稳定状态: 已有订阅显示“资源不可用”；重复归档幂等；本阶段无恢复入口。

## Team Publish / Review / Featured

- 触发: 创建者提交 Team 审核；来源 Team owner/admin 批准、拒绝、撤回或设置 Featured。
- 可见结果: `teamStatus` 在 draft/pending/published/rejected 间合法转换，动作写入审计。
- 权限失败: 普通成员看不到审核/精选动作，直接调用返回 403。
- Team 行为: 只管理 `originTeamId` 为当前 Team 的资源；published 内容编辑不重新审核。
- 稳定状态: 非法状态转换返回 409；Team Featured 仅适用于 published 且未归档资源。

## BoardX Publish / Review / Featured

- 触发: 所有者或来源 Team owner/admin 提交；BoardX Admin 批准、拒绝、撤回 approved 或设置 Featured。
- 可见结果: approved 资源对所有认证用户可见；首次审核后内容编辑立即传播且保持 approved。
- 权限失败: 非提交角色或非 BoardX Admin 返回 403。
- Team 行为: BoardX 可见性不改变 `originTeamId`；撤回后其他 Team 不可新订阅或新执行。
- 稳定状态: 非法转换返回 409；Featured 仅适用于 approved、未归档资源。

## USER and TEAM Subscription

- 触发: 用户在详情选择“为我订阅”或管理员选择“为 Team 订阅/取消”。
- 可见结果: USER 仅当前用户可用，TEAM 对当前 Team 全体成员可用；重复请求幂等。
- 权限失败: 普通成员请求 TEAM 订阅返回 403；不可订阅资源返回 409/410。
- Team 行为: 每条关系强制 `consumerTeamId=currentTeamId`，Team B 可订阅 Team A approved 资源。
- 稳定状态: Subscribe 列表区分个人/团队来源；取消后对应选择器立即移除。

## Agent Use

- 触发: 已有 USER 或 TEAM 订阅的用户点击 Use。
- 可见结果: 在当前 Team 打开或创建 AVA 会话并应用 Agent 最新指令、模型、Deep Agent 和工作流配置。
- 权限失败: 无订阅返回 403；归档或撤回 approved 返回 410。
- Team 行为: 会话和使用记录属于当前 `consumerTeamId`，不写入来源 Team。
- 稳定状态: 启动失败保留详情上下文并可重试。

## Skills Use

- 触发: 用户在详情或 AVA Skills 选择器选择已订阅 Skill。
- 可见结果: 始终加载最新版本，并按 `skillKind=text|image` 进入正确执行链。
- 权限失败: 无当前 Team 订阅、无 Team membership 或资源不可用返回 403/410。
- Team 行为: 选择器只显示当前 Team 下个人或团队可用 Skills；切换 Team 清空选择。
- 稳定状态: 不支持的 `skillKind` 返回稳定错误，不退化到另一执行链。

## Template Use

- 触发: 已订阅用户打开、连接或从 Template 创建内容。
- 可见结果: 在当前 Team 创建/连接 Board 内容，并使用 Template 最新版本。
- 权限失败: 无订阅或源资源不可用返回 403/410。
- Team 行为: 新内容属于当前 `consumerTeamId`；不能获得来源 Team Board 的编辑权。
- 稳定状态: Board 创建失败不产生半关联记录，可安全重试。

## Favorite and View Statistics

- 触发: 用户打开详情、收藏或取消收藏。
- 可见结果: view count 服务端计数；收藏状态和真实聚合喜欢数在卡片/详情一致。
- 权限失败: 不可见资源不能计数或收藏。
- Team 行为: 收藏键包含 user、current Team、item；同一用户在不同 Team 独立。
- 稳定状态: UI 可乐观更新，服务端失败必须回滚；重复请求幂等。

## Shared / Authorized

- 触发: 所有者创建编辑链接；接收者查看并接受；所有者查看列表、关闭链接或撤销用户。
- 可见结果: 接收者在 Authorized 看到原资源并可编辑内容；所有者在 Shared 看到授权状态。
- 权限失败: 非所有者不能管理分享；被授权者不能转授、归档或改生命周期。
- Team 行为: 授权可跨 Team，但 `originTeamId`、`createdBy` 不变，也不产生 Team membership。
- 稳定状态: 无效/过期/撤销 token 返回 410；重复接受幂等；撤销立即失效。

## Copy

- 触发: 可见资源的用户在 `allowCopy=true` 时选择复制到当前 Team。
- 可见结果: 创建新 `itemId`、private/draft/not_submitted 独立副本并记录来源 item/version。
- 权限失败: `allowCopy=false` 或资源不可见返回 403。
- Team 行为: 副本 `originTeamId=currentTeamId`、`createdBy=currentUserId`；Template 深拷贝 Board。
- 稳定状态: 不继承订阅、收藏、统计、审核、Featured、分享；幂等键避免重试产生意外重复。

## Agent Builder

- 触发: 创建者在 Agent 创建流程向 Assistant 提交一轮需求。
- 可见结果: 返回可编辑的 Agent 名称、描述、指令、模型和建议问题草案，用户确认后保存。
- 权限失败: 未登录、无当前 Team 或无创建权限返回 401/403。
- Team 行为: Builder 会话和最终 Agent 均归当前 Team，切换 Team 后不能继续旧会话写入。
- 稳定状态: 模型失败可重试且不创建半成品；非法输出返回可读校验错误。

## Skill Next Recommendations

- 触发: Skill 使用完成或详情请求下一步推荐。
- 可见结果: 返回与该 Skill 关联、当前用户在当前 Team 可使用的 Agent 建议。
- 权限失败: Skill 不可见/不可用或无使用权返回 403/410。
- Team 行为: 推荐不得泄露来源 Team 私有 Agent；公共 Agent 仍需当前 Team 订阅才能执行。
- 稳定状态: 无推荐返回空数组而非错误；推荐服务失败不影响 Skill 主结果。
