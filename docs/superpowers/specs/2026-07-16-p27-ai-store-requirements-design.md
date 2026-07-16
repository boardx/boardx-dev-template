# Phase p27 AI Store 完整需求设计

- 日期: 2026-07-16
- 状态: 已确认设计，待写入 p27 requirements 与 feature_list
- 目标仓库: `boardx-dev-template`
- 事实来源: `boardx-web`、`boardx-backend`、`phase-p11-ai-store`

## 1. 目标

Phase p27 不只完成 AI Tool 与 Image Tool 的改名，而是把现有 AI Store 业务闭环整理成一份可独立实施和验收的规格，并完成以下变化：

1. Agent、Skill、Template 全部具有强制 Team 归属。
2. AI Tool 与 AI Image Tool 合并为统一的 Skills 分类。
3. Team 资源通过 BoardX 审核后可被其他 Team 订阅和使用。
4. 已审核资源后续编辑立即生效，不重新审核，并自动影响所有订阅者。
5. 所有 Agent、Skill、Template 都支持管理编辑授权分享。
6. 所有资源都有 `allowCopy` 开关；开启后，其他用户可在当前 Team 创建独立副本。
7. 保留并明确 Explore、创建编辑、发布审核、订阅使用、收藏、分享、精选、删除和推荐等现有能力。

## 2. 源码事实

### 2.1 boardx-backend

- `src/core/entities/aistore.ts` 定义 Agent、Template、AI Tool、AI Image Tool，以及 Private、Team、BoardX 三种访问级别。
- `src/ai-store/ai-store.controller.ts` 提供列表、分页、订阅列表、创建、更新、删除、详情、Team 资源、BoardX 资源、精选、管理授权分享和工具后续推荐接口。
- `src/ai-store-subscription/` 区分 USER 与 TEAM 订阅，并记录订阅 Team。
- `src/ai-store-favorite/` 提供收藏状态和喜欢数维护。
- `src/ai-store/infrastructure/persistence/document/entities/ai-store-authorization.schema.ts` 已有 LINK、ACCEPTED、REVOKED 授权状态和 `edit` 权限。
- 旧授权实现存在所有权漂移风险：授权查询过程中曾改写资源 `createdBy`。新设计明确禁止这种行为。
- 旧 Mongo schema 使用 `strict: false`，不能作为新模型的数据校验标准。

### 2.2 boardx-web

- AI Store 有 Explore、Subscribe、Create、Authorized、Shared 五个主视图。
- Agent、AI Tool、AI Image Tool、Template 有独立创建、预览、编辑和使用动作。
- Agent 使用时进入 AVA，并可切换模型、Deep Agent 和工作流配置。
- AI Tool 与 AI Image Tool 使用时分别进入 AVA 的文本工具和图片工具状态。
- Template 关联 Board，可打开和连接模板 Board。
- 支持个人订阅、Team 订阅、喜欢、管理授权分享、Team 审核、BoardX 审核与精选。
- `agent-builder/turn` 和 Agent Creation Assistant 提供 Agent 创建辅助。
- `getNextToolRecommendations` 根据 Skill 与 Agent 关联提供下一步推荐。

### 2.3 boardx-dev-template

- P11 已实现浏览、创建更新、订阅使用、收藏、分享、Team 审核和精选的基础闭环。
- 当前类型仍是 `agent | ai-tool | image-tool | template`。
- 当前 `team_id` 可空，个人订阅可使用 `team_id=null`，与本设计的强制 Team 规则不一致。
- 平台审核和官方精选另有 Admin E2E，p27 必须纳入回归范围。

## 3. 已确认产品决策

### 3.1 实时可变资源

- 资源首次发布到 BoardX 必须审核。
- BoardX 审核通过后，资源进入可订阅状态。
- 所有者或授权编辑者后续修改原资源时，不重新审核。
- 修改保存成功后立即成为当前版本。
- 所有个人订阅和 Team 订阅在下一次读取或执行时使用当前版本。
- 系统不为订阅者保存审核版本快照，也不提供手动升级步骤。
- 每次修改递增 `version`，并记录修改人、修改时间和变更字段，用于问题追踪，但审计记录不阻止修改生效。

### 3.2 订阅与复制不同

- 订阅引用原资源 `itemId`，持续跟随原资源最新版。
- 复制创建新的 `itemId`，复制后与原资源完全独立。
- 原资源后续修改不会同步到副本。
- 副本后续修改也不会影响原资源或其他副本。

### 3.3 Team 归属与消费 Team

- 每个资源都有不可为空且不可通过普通编辑改变的 `originTeamId`。
- BoardX 资源跨 Team 可见，但来源 Team 不变。
- Team B 订阅 Team A 的 BoardX 资源时，订阅保存 `consumerTeamId=Team B`，资源仍保存 `originTeamId=Team A`。
- Team B 可使用该资源，但不能因订阅而获得编辑、分享管理、发布管理或删除权限。

## 4. 领域模型

### 4.1 Resource

所有 Agent、Skill、Template 共用以下字段：

| 字段 | 规则 |
| --- | --- |
| `itemId` | 资源唯一标识；迁移和编辑时保持不变 |
| `type` | `agent | skill | template` |
| `originTeamId` | 强制非空；创建时来自可信当前 Team；普通编辑不可修改 |
| `createdBy` | 原始所有者；接受编辑分享不会改变所有者 |
| `name` | 必填 |
| `description` | 必填 |
| `icon` / `cover` | 可选展示资源 |
| `tags` | 搜索和筛选标签 |
| `examples` | 详情页示例 |
| `visibility` | `private | team | boardx` |
| `teamStatus` | `draft | pending | published | rejected` |
| `boardxStatus` | `not_submitted | pending | approved | rejected` |
| `featured` | Team 或 BoardX 精选状态，由对应管理员控制 |
| `allowCopy` | 所有者控制；默认 `false` |
| `version` | 从 1 开始；每次有效内容修改后递增 |
| `copiedFromItemId` | 副本的来源资源，可空 |
| `copiedFromVersion` | 复制时的来源版本，可空 |
| `archivedAt` | 软删除时间，可空 |
| `createdAt` / `updatedAt` | 创建和最近更新时间 |

### 4.2 类型配置

#### Agent

- 指令、模型、输入能力、Deep Agent 开关。
- 建议问题、工作流编排和 Agent 创建助手结果。
- 使用时连接到当前 Team 的 AVA 会话；没有会话时创建当前 Team 会话。

#### Skill

- `skillKind=text|image` 是执行差异，不是商店分类。
- 两类 Skill 共用名称、描述、指令、模型、输出配置、参考图片和 Deep Agent 等基础字段。
- text 可配置结构化输出和 artifact 类型。
- image 可配置比例、图片模型、负面提示词和参考图片。
- 使用时进入当前 Team 的 AVA Skills 选择器，并按 `skillKind` 分派执行链路。

#### Template

- 关联模板 Board 和预览信息。
- 使用时在当前 Team 创建或连接内容。
- 复制 Template 时必须复制 Board 内容到目标 Team，不能继续把目标 Team 的副本绑定到来源 Team 的可编辑 Board。

### 4.3 Subscription

| 字段 | 规则 |
| --- | --- |
| `itemId` | 被订阅原资源 |
| `subscriptionType` | `USER | TEAM` |
| `consumerTeamId` | 强制非空 |
| `subscribedByUserId` | 发起订阅的人 |
| `subscriberUserId` | USER 订阅时必填 |
| `createdAt` | 订阅时间 |

- USER 订阅只对该用户在当前 Team 生效。
- TEAM 订阅对当前 Team 全体成员生效，只允许 Team owner/admin 操作。
- 同一用户或 Team 对同一资源的订阅必须幂等。
- 取消订阅只删除消费关系，不影响原资源。
- 资源归档后不能新订阅或新执行；已有订阅显示资源不可用。

### 4.4 EditAuthorization

| 字段 | 规则 |
| --- | --- |
| `itemId` | 被授权编辑的原资源 |
| `ownerUserId` | 资源所有者 |
| `granteeUserId` | 接受授权的人 |
| `originTeamId` | 来源 Team，不使用接受者当前 Team 覆盖 |
| `permissions` | 本阶段固定为 `edit` |
| `status` | `LINK | ACCEPTED | REVOKED` |
| `acceptedAt` / `revokedAt` | 审计时间 |

- 被授权人可以跨 Team 编辑原资源，不需要成为来源 Team 成员。
- 被授权人不能改变 `originTeamId`、所有者、BoardX 状态、Team 状态、精选状态、`allowCopy` 或分享授权。
- 被授权人不能删除资源，也不能把编辑权限继续分享给别人。
- 关闭分享链接会使旧 token 失效，并撤销由该链接产生的编辑权限。
- 所有者可单独撤销某个授权用户。
- 接受授权不会修改 `createdBy`。

### 4.5 Copy

- `allowCopy=false` 时，任何非所有者复制请求返回 403。
- `allowCopy=true` 时，能查看资源的已登录用户可复制到当前 Team。
- 副本获得新 `itemId`、`originTeamId=currentTeamId`、`createdBy=currentUserId`。
- 副本默认 `visibility=private`、`teamStatus=draft`、`boardxStatus=not_submitted`、`featured=false`。
- 副本不继承订阅、收藏、统计、审核、精选、分享 token 或编辑授权。
- Agent/Skill 配置完整复制；Template 的 Board 内容复制到目标 Team。
- 副本记录 `copiedFromItemId` 和 `copiedFromVersion`。
- 原资源后来关闭复制，不影响已经创建的副本。

### 4.6 RevisionAudit

每次创建、编辑、发布、审核、精选、授权、撤销、复制和归档写入审计记录：

- `itemId`
- `version`
- `action`
- `actorUserId`
- `actorTeamId`
- `changedFields`
- `createdAt`

本阶段不提供版本回滚 UI，审计用于追踪实时修改来源。

## 5. 完整用户功能基线

### 5.1 导航与视图

- 全局侧栏可进入 AI Store。
- 模块内提供 Explore、Subscribe、Create、Authorized、Shared。
- Explore、Subscribe、Create、Shared 以当前 Team 为上下文；切换 Team 后清空旧列表、旧选择和缓存并重新加载。
- Authorized 是显式例外：按当前用户列出其接受的全部有效编辑授权，可包含其他来源 Team 的资源；每项必须展示来源 Team。
- 未登录访问跳转登录；无当前 Team 或已离开 Team 时显示明确错误，不回退到任意 Team。

### 5.2 Explore

- 展示当前 Team 自有可见资源及审核通过的 BoardX 资源。
- 类型 Tab 为 All、Agent、Skills、Template。
- Skills 不再拆成 AI Tool 和 Image Tool。
- 支持关键词、标签、类型、精选筛选和分页。
- 卡片显示封面、名称、作者、来源 Team、类型、喜欢数和精选标志。
- 详情显示描述、示例、配置摘要、统计、当前版本、来源 Team、订阅、使用、收藏和复制入口。
- 提供加载、空态、失败重试和稳定分页终态。

### 5.3 Create、Edit、Preview

- 创建者从 Agent、Skill、Template 中选择类型。
- Skill 创建时选择 text 或 image。
- 所有类型支持实时预览、必填校验、保存草稿和编辑。
- 创建接口忽略客户端伪造的 `originTeamId`，使用可信当前 Team。
- 所有者和有效授权编辑者可以编辑内容字段。
- 编辑成功递增版本并立即影响所有订阅者。
- 已审核资源编辑后保持 BoardX approved，不重新进入 pending。
- Agent 创建助手继续作为 Agent 创建流程的可选辅助能力。

### 5.4 Delete / Archive

- 只有所有者可以归档资源。
- 归档代替物理删除，保留关系和审计记录。
- 归档资源从 Explore、Create、Authorized 和新订阅入口隐藏。
- 已有订阅显示“资源不可用”，不能开始新的执行。
- 本阶段不提供恢复归档功能。

### 5.5 Team 发布与审核

- 创建者把 Team 资源提交为 pending。
- Team owner/admin 可以批准为 published、拒绝为 rejected、把 published 撤回 pending。
- Team 精选只适用于当前 Team 已 published 的资源。
- 无 Team 管理权限的用户看不到审核和精选动作。
- 审核和精选动作写审计记录。
- 已 published 资源后续内容编辑立即生效，不重新 Team 审核。

### 5.6 BoardX 发布、审核与精选

- 只有来源 Team 的 owner/admin 或资源所有者可以提交 BoardX 审核。
- BoardX Admin 可以批准、拒绝或撤回批准。
- 只有 approved 且未归档的资源进入 BoardX Explore 和订阅入口。
- BoardX Featured 只适用于 approved 资源。
- 首次 approved 后，所有者或授权编辑者修改内容不重新审核，立即影响全部订阅者。
- BoardX Admin 撤回批准后，其他 Team 不能新订阅或新执行；已有订阅显示资源不可用。
- 审核、撤回和精选均写审计记录，包括操作者和时间。

### 5.7 Subscription 与 Use

- 用户可对可订阅资源创建 USER 订阅。
- Team owner/admin 可为当前 Team 创建 TEAM 订阅。
- Team B 只有订阅 Team A 已 approved 的 BoardX 资源后，才可在 Team B 使用它。
- USER 和 TEAM 订阅列表按当前 Team 隔离。
- Agent 在当前 Team 的 AVA 中启用。
- Skill 在当前 Team 的 AVA Skills 选择器中启用。
- Template 在当前 Team 创建或连接内容。
- 订阅始终解析原资源最新版本。
- 取消订阅后资源从对应选择器移除。
- Skill 使用完成后可根据关联 Agent 返回下一步推荐。

### 5.8 Favorite 与统计

- 用户可在当前 Team 对可见资源收藏或取消收藏。
- 收藏关系键包含用户、当前 Team 和资源。
- 卡片与详情显示当前用户收藏状态和真实聚合喜欢数。
- UI 可乐观更新，但服务端失败必须回滚。
- 打开详情增加 view 统计；重复计数策略由实现保持现有口径。

### 5.9 Share、Authorized、Shared

- 所有 Agent、Skill、Template 都可以创建编辑授权链接。
- 只有所有者可以创建、关闭链接和管理授权用户。
- 已登录用户接受链接后，在 Authorized 看到原资源并可编辑内容；不要求加入来源 Team。
- Authorized 按用户授权查询，不按接受者当前 Team 过滤；资源卡片必须显示并锁定来源 Team。
- 所有者在当前 Team 的 Shared 查看正在分享的资源和被授权用户。
- 授权编辑跨 Team 生效，但不改变资源来源 Team和所有权。
- 关闭链接后旧 token 和由该 token 产生的全部授权立即失效；重新开启会生成新 token，不恢复旧授权。
- 单独撤销用户后，该用户立即失去编辑能力。
- 失效链接显示稳定错误终态，不泄露资源配置。

### 5.10 Copy

- 详情和管理列表根据 `allowCopy` 显示复制入口。
- 所有者可以开启或关闭复制。
- 复制前明确显示目标 Team。
- 复制成功后进入目标 Team 的 Create 列表，并可独立编辑、发布和分享。
- 复制不等于订阅，不跟随原资源更新。

## 6. 权限矩阵

| 动作 | 所有者 | 授权编辑者 | 来源 Team Admin | 消费 Team Admin | BoardX Admin | 普通订阅者 |
| --- | --- | --- | --- | --- | --- | --- |
| 查看可见资源 | 是 | 是 | 是 | 是 | 是 | 是 |
| 编辑内容 | 是 | 是 | 否，除非另有授权 | 否 | 否 | 否 |
| 修改来源 Team | 否 | 否 | 否 | 否 | 否 | 否 |
| 设置 `allowCopy` | 是 | 否 | 否 | 否 | 否 | 否 |
| 创建/撤销编辑分享 | 是 | 否 | 否 | 否 | 否 | 否 |
| 归档资源 | 是 | 否 | 否 | 否 | 否 | 否 |
| 提交 Team/BoardX 审核 | 是 | 否 | 是 | 否 | 否 | 否 |
| Team 审核/精选 | 否 | 否 | 是 | 否 | 否 | 否 |
| BoardX 审核/精选 | 否 | 否 | 否 | 否 | 是 | 否 |
| USER 订阅 | 是 | 是 | 是 | 是 | 是 | 是 |
| TEAM 订阅 | 否 | 否 | 来源 Team 可操作 | 消费 Team 可操作 | 否 | 否 |
| 复制允许复制的资源 | 是 | 是 | 是 | 是 | 是 | 是 |

## 7. API 行为原则

- Team 上下文来自可信会话或当前 Team cookie；不能以 body 中的任意 Team id 作为授权依据。
- 资源响应包含 `originTeamId`、来源 Team 名称、`version`、`allowCopy` 和当前用户权限。
- Explore、Create、Subscribe、Shared、收藏、审核、复制和执行接口验证当前 Team 成员关系。
- Authorized 列表、接受授权和授权编辑接口改为验证当前用户的有效授权记录，不要求其是来源 Team 成员；接口仍从资源读取并锁定 `originTeamId`。
- 对无权访问的其他 Team 私有资源返回 404；对已识别但动作无权执行的资源返回 403。
- 未知 `type` 或 `skillKind` 返回 400。
- 重复订阅、重复接受授权和重复审核动作必须幂等。
- 修改接口使用服务端字段白名单，授权编辑者提交生命周期字段时返回 403，而不是静默接受。
- 编辑成功响应返回新 `version`；订阅消费接口不接受客户端指定旧版本。

## 8. 迁移规则

### 8.1 类型迁移

- `ai-tool` / `AI_TOOL` → `type=skill, skillKind=text`。
- `image-tool` / `AI_IMAGE_TOOL` → `type=skill, skillKind=image`。
- Agent 与 Template 类型不变。
- 迁移原位进行，保持 item id 和现有关系。

### 8.2 Team 迁移

- 已有 Team 归属原样保留为 `originTeamId`。
- 可以从唯一创建 Team 或关系确定归属的记录原位回填。
- 无法唯一归属的记录进入审计清单，不进入可管理、可订阅或可执行列表。
- 必须提供管理员可运行的归属修复命令；修复动作写审计记录。

### 8.3 订阅与授权迁移

- 旧 USER 订阅补齐当时资源使用 Team；无法确定时进入审计清单。
- 旧 TEAM 订阅的 `subscribedByTeamId` 映射为 `consumerTeamId`。
- 旧编辑授权保留 item id、owner、grantee 和状态，但 Team 统一使用资源 `originTeamId`。
- 迁移禁止改写资源所有者。

### 8.4 实时版本初始化

- 现有资源 `version` 初始化为 1。
- 迁移本身不视为内容编辑，不触发版本递增。
- 首次后续编辑递增到 2，并立即对订阅者生效。

## 9. 错误与边界

- Team 上下文视图中，当前 Team 不存在或用户不是成员：403，并清理客户端旧 Team 状态；Authorized 授权编辑不以来源 Team 成员身份作为前提。
- 资源未审核、被撤回或已归档：不能跨 Team 新订阅或执行。
- 订阅存在但资源不可用：保留订阅记录并显示不可用原因。
- 授权 token 无效、关闭或已撤销：404/410，不返回资源配置。
- 两人同时编辑：使用 `version` 做乐观并发控制；旧版本提交返回 409，要求重新加载后再保存。
- 被撤销授权的编辑者继续提交：403，不能覆盖新版本。
- 复制过程中来源资源关闭复制：事务提交前再次检查 `allowCopy`。
- Template Board 复制失败：不创建半成品 Resource；整体失败并可重试。

## 10. 验证策略

### 10.1 数据和 API

- Team A/Team B 同名资源隔离。
- origin Team 与 consumer Team 分离。
- USER/TEAM 订阅幂等和 Team 隔离。
- 首次 BoardX 审核后可跨 Team 订阅。
- 审核后编辑版本递增且无需重审。
- 订阅者读取新版本。
- 编辑授权不改变所有者和来源 Team。
- `allowCopy` 权限、复制字段和关系清空。
- 迁移幂等与无法归属清单。

### 10.2 Web E2E

- Explore 搜索、标签、分页、详情、空态和登录门禁。
- 单一 Skills Tab 和 text/image 创建编辑。
- Agent、Skill、Template 的 Team 内使用入口。
- Team B 订阅 Team A approved BoardX 资源并使用。
- Team A 编辑后 Team B 立即读取新版本。
- 分享接受、跨 Team 编辑、撤销用户和关闭链接。
- 开启复制、复制到目标 Team、独立编辑且不跟随原资源。
- Team 审核、BoardX 审核、两级精选与权限拒绝。
- 收藏乐观更新失败回滚。
- Team 切换后列表、订阅和 AVA 选择无旧数据残留。
- 全局侧栏可发现 AI Store。

### 10.3 必须纳入的现有回归

- P11 `ai-store-001` 至 `ai-store-006`。
- Admin `admin-003-ai-store-approval`。
- Admin `admin-004-featured-ai-store`。
- AVA AI settings / Skills 选择器相关回归。

## 11. 建议 Feature 拆分

1. Team 资源归属、关系隔离与迁移审计。
2. Skills 类型合并、类型配置和版本字段。
3. Explore、导航、搜索、筛选、分页和详情。
4. Agent/Skill/Template 创建、编辑、预览和归档。
5. Team 与 BoardX 发布、审核、精选和审计。
6. USER/TEAM 订阅、跨 Team 使用和实时版本传播。
7. 收藏、喜欢数和浏览统计。
8. 编辑授权分享、Authorized/Shared 和撤销。
9. `allowCopy` 与三类资源独立复制。
10. AVA/Template 使用、Agent 创建助手和 Skill 后续推荐。
11. 旧类型、旧关系、旧 URL 和全链路兼容回归。

每个 Feature 必须有独立行为验证；不能再把浏览、创建、订阅、收藏、分享和审核全部压进一个回归 Feature。

## 12. 明确不做

- 不引入 Model 或 Dataset 商店分类。
- 不要求审核后编辑重新审核。
- 不为订阅者保留版本快照。
- 不让副本跟随原资源自动更新。
- 不允许授权编辑者转移所有权或继续分享权限。
- 不提供版本回滚 UI。
- 不重做 AI Store 视觉设计。

## 13. 风险与接受方式

- 审核后编辑立即生效意味着订阅者可能受到错误修改影响。产品已明确接受该成本，以降低重复审核和升级成本。
- 通过版本号、乐观并发控制、修改审计、授权撤销和管理员撤回 BoardX approval 提供最低限度的追踪与止损能力。
- 授权编辑与 Team 成员身份分离，所有接口必须使用显式授权记录，不能把被授权人改成所有者或来源 Team 成员。
- Template 复制涉及真实 Board 内容，必须做目标 Team 的深复制，不能只复制商店元数据。
