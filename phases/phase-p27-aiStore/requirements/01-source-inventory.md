# 现有能力与来源盘点

## 盘点原则

旧仓库是行为和兼容输入的事实来源，不是逐文件复制目标。模板仓库继续使用 Next.js Route Handler + `@repo/data` 的架构边界。下表的“保留”表示迁移现有行为，“调整”表示按 P27 已确认规则改变语义，“排除”表示不进入本阶段。

## 功能映射

| 能力 | `boardx-web` 来源 | `boardx-backend` 来源 | P27 处理 |
| --- | --- | --- | --- |
| List/search/pagination/detail/view count | `src/components/aistore/Resource.tsx`、`StoreItem/`、`src/redux/services/ai-store.api.slice.ts` | `src/ai-store/ai-store.controller.ts`、repository list/detail/view count | 保留；增加 BoardX approved 全员可见、Team 隔离和稳定分页状态 |
| Create/update/delete | `src/components/aistore/DevTool/`、Agent/Template 编辑组件 | `src/ai-store/ai-store.controller.ts` create/update/delete | 调整；创建强制当前 Team，删除改为 archive，approved 编辑实时生效 |
| Agent builder | `src/app/api/v1/ai-store/agent-builder/turn/route.ts`、Agent Creation Assistant | `src/ai-store/agent-builder.ts`、`POST agent-builder/turn` | 保留；创建结果写入当前 Team |
| USER/TEAM subscriptions | `src/redux/services/ai-store.api.slice.ts`、订阅与使用动作 | `src/ai-store-subscription/` | 调整；普通成员仅 USER，owner/admin 才可 TEAM，均强制 `consumerTeamId` |
| Favorites | Store Item 收藏动作 | `src/ai-store-favorite/` | 保留；关系键增加当前 Team，失败时回滚乐观 UI |
| Team review and featured | Team 管理/审核界面 | AI Store status/featured 服务与仓储 | 保留；仅来源 Team owner/admin |
| BoardX review and featured | BoardX/Admin 管理界面 | BoardX scope/status/featured 查询与更新 | 调整；首次审核，approved 后内容编辑免复审且实时传播 |
| Management-share create/info/accept/access-list/revoke/revoke-user | Authorized、Shared、分享落地页 | `src/ai-store/ai-store.controller.ts` 的 `management-share/*`、authorization schema/repository | 调整；跨 Team 编辑原资源，禁止所有权漂移 |
| Agent use | `StoreItemAction.tsx`、`ActionAvaChatSelectAgent.tsx` | Agent/AVA 执行入口 | 保留；要求当前 Team USER/TEAM 订阅 |
| Text Skill use | `DevTool/Tool/`、AVA tool state | AI Tool subscription/factory | 合并为 `skillKind=text` |
| Image Skill use | `DevTool/ImageTool/`、AVA image tool state | AI Image Tool subscription/factory | 合并为 `skillKind=image` |
| Template use | Template 预览、打开/连接 Board | Template item config | 保留；跨 Team 复制时深拷贝 Board |
| Skill-to-Agent next recommendations | 使用完成后的下一步推荐 UI | `GET getNextToolRecommendations/:toolId`、`getNextToolRecommendations` | 保留；输入统一 Skill，返回当前 Team 可使用 Agent |

## 类型与数据来源

- `boardx-backend/src/core/entities/aistore.ts` 定义 `AGENT`、`AI_TOOL`、`AI_IMAGE_TOOL`、`TEMPLATE` 及 Private、Team、BoardX 访问级别。
- `boardx-backend/src/ai-store/infrastructure/persistence/document/entities/ai-store.schema.ts` 为旧资源 schema；其宽松字段策略不能替代 P27 的规范校验。
- `boardx-backend/src/ai-store/infrastructure/persistence/document/entities/ai-store-authorization.schema.ts` 已有 LINK、ACCEPTED、REVOKED 和 `edit` 权限。
- `boardx-backend/src/ai-store-subscription/.../ai-store-subscription.schema.ts` 区分 USER 与 TEAM。
- `boardx-web/src/definition/ai/aistore.ts` 与 `Resource.tsx` 把 AI Tool、AI Image Tool 暴露为两个类型和路由。
- `boardx-web/src/components/aistore/DevTool/Tool/` 与 `DevTool/ImageTool/` 保留两类不同编辑和执行字段。

## 模板仓库现状

- `packages/data/src/aiStore.ts`: 当前类型仍是 `agent | ai-tool | image-tool | template`，`team_id` 可空。
- `apps/web/app/api/ai-store/items/payload.ts`: 创建/更新仍分别接受两种工具类型。
- `apps/web/app/(app)/ai-store/store-browser.tsx`: 已有商店主体验，但分类和 Team 规则需调整。
- `apps/web/app/(app)/ava/page.tsx`: 已有 Skills 文案与选择器形态，是统一使用入口。
- `apps/web/e2e/ai-store-001..006-*.spec.ts`: 覆盖浏览、创建更新、订阅使用、收藏、分享、审核精选。
- Admin E2E 已覆盖 BoardX 审核与 Featured，P27 最终回归必须纳入。

## 明确排除

- 旧枚举中的 Model、Dataset：没有完整用户可见商店闭环，不在 P27 创建新分类。
- 旧实现中接受授权时改写 `createdBy` 的行为：判定为所有权漂移缺陷，不兼容。
- 旧 Mongo `strict: false` 带来的任意字段写入：不作为 API 契约。
- 通过复制资源来模拟订阅升级：与“订阅跟随源资源最新版”冲突，排除。
