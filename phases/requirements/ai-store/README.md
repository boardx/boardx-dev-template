# AI Store Use Cases

AI Store 的用例按“用户目标”定义，不按个人、团队、Admin 三套入口重复拆分。

同一个 AI Store 项目可能在个人入口、团队入口和 Admin 入口中出现，但 Actor 的目标和权限不同：

- 个人入口关注发现、收藏、订阅、使用和管理自己创建的项目。
- 团队入口关注在当前 Team 上下文中探索、订阅、审批和分发团队可用能力。
- Admin 入口关注平台级审核、精选和治理。

## 入口映射

| 入口场景 | 典型 Actor | 对应用例 |
| --- | --- | --- |
| 个人 AI Store Explore / Subscribe | 普通用户、Team 成员 | `uc-ai-store-001-browse-items.md`、`uc-ai-store-003-subscribe-use-item.md`、`uc-ai-store-004-favorite-item.md` |
| 我的 AI Store 项目 | AI Store 创作者 | `uc-ai-store-002-create-update-item.md`、`uc-ai-store-005-share-management.md` |
| Team 管理页 > AI Store Explore / Subscribe | Team Owner、Team Admin、Team Member | `../team/uc-team-010-view-team-ai-store.md` 进入团队上下文，再落到 `uc-ai-store-001-browse-items.md`、`uc-ai-store-003-subscribe-use-item.md` |
| Team 管理页 > AI Store Approval | Team Owner、Team Admin | `../team/uc-team-010-view-team-ai-store.md` 进入团队上下文，再落到 `uc-ai-store-006-approval-featured.md` |
| Admin Panel > AI Store Approval | BoardX Admin | `../admin/uc-admin-003-ai-store-approval.md`，能力边界对应 `uc-ai-store-006-approval-featured.md` |
| Admin Panel > AI Store Featured | BoardX Admin | `../admin/uc-admin-004-featured-ai-store.md`，能力边界对应 `uc-ai-store-006-approval-featured.md` |

## 用例边界

`ai-store/` 下的文件描述 AI Store 的核心业务能力：

- 浏览和筛选项目。
- 创建或更新项目。
- 订阅并使用项目。
- 收藏项目。
- 管理项目分享授权。
- 审核和精选项目。

`team/` 和 `admin/` 下的文件描述从 Team 或 Admin 场景进入 AI Store 的方式，以及对应角色能否看见入口、能否进入管理页。

## 权限原则

1. 普通用户可以浏览、收藏、个人订阅和使用自己可见的 AI Store 项目。
2. AI Store 创作者可以创建、编辑、发布、删除或分享自己有权管理的项目。
3. Team Owner/Admin 可以在团队上下文中管理团队订阅和团队审核。
4. Team Member 可以使用团队已授权或个人已订阅的项目，但不默认拥有团队审核或团队订阅管理权。
5. BoardX Admin 可以进行平台级审核、精选和治理。

## 不重复拆分的原因

如果把“个人浏览 AI Store”“团队浏览 AI Store”“Admin 浏览 AI Store”拆成三套完整用例，会造成同一用户目标在多个文件中重复定义。

因此当前文档采用：

- `ai-store/` 定义核心目标。
- `team/uc-team-010-view-team-ai-store.md` 定义团队入口与团队上下文。
- `admin/uc-admin-003-ai-store-approval.md` 和 `admin/uc-admin-004-featured-ai-store.md` 定义平台 Admin 入口。

当某个入口出现独立目标、独立权限或独立异常流程时，再新增专门用例。

## 仍需确认

1. AI Store 收藏入口在当前产品中是否对所有可见项目开放。
2. Team Approval 的 Owner/Admin 精确权限差异。
3. Admin 审核拒绝时是否必须填写拒绝原因。
4. AI Store DevTool 中 Agent、Tool、Template、Image Tool 是否需要继续拆成独立创建器用例。
