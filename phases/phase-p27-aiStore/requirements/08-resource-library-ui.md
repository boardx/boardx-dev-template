# AI Store Resource Library UIUX

## 事实来源

- 完整设计规格: `docs/superpowers/specs/2026-07-17-ai-store-resource-library-redesign.md`
- 实施计划: `docs/superpowers/plans/2026-07-17-ai-store-resource-library-implementation.md`
- 人类选择: Resource Library Option 1，不混用其他视觉候选。

## 工作区导航

- 持久导航包含 Explore、Featured、My subscriptions、Created by me、Authorized editing、Shared with me、Team review 和 BoardX review。
- Team review 仅当前 Team owner/admin 可见；BoardX review 仅 BoardX Admin 可见。
- `Create resource` 是唯一常驻主操作，明确显示目标 Team。
- Authorized editing 按用户跨 Team 聚合并显示来源 Team；其他业务视图按当前 Team 隔离。

## 浏览与详情

- 桌面为紧凑资源表格，平板收窄字段，移动端为单列资源列表。
- 搜索、类型、标签、排序和分页同步到安全 URL 状态。
- 选择资源后打开右侧详情面板并保留列表上下文；移动端使用全屏详情抽屉。
- 行与详情展示类型、来源 Team、版本、发布/可用状态、订阅范围和更新时间。
- loading、empty、网络失败、403、404、409、410 使用局部稳定状态，不替换整个工作区。

## 订阅、使用、分享与复制

- 订阅显式区分 `For me` 与 `For team`；TEAM 操作只向当前 Team owner/admin 开放。
- 使用要求当前 Team 下有效 USER 或 TEAM 订阅，并始终解析最新版本。
- Shared with me 是收到的分享邀请；Authorized editing 是已接受且仍有效的原资源编辑授权。
- Created by me 和资源详情负责所有者的外发链接、授权用户、撤销和 `allowCopy` 管理。
- 复制前显示目标 Team，成功后进入目标 Team 的 Created by me 独立草稿。

## 创建、编辑与审核

- Agent、Skill、Template 共用一致编辑框架；Skill 继续区分 text/image 执行配置。
- 编辑器包含真实表单、实时预览、保存中、成功、字段校验、未保存内容和版本 409 状态。
- 已 published/approved 资源修改后保持审核状态并立即同步订阅者。
- Team review 与 BoardX review 复用资源列表、详情、确认和审计模式。

## 设计系统与验收

- 复用 BoardX 应用壳、语义 token、字体刻度、4/8px 间距、shadcn/ui 与 Lucide 图标。
- 禁止营销 Hero、渐变装饰、嵌套卡片、任意像素、裸表单元素和仅用颜色表达状态。
- 375px、768px、1280px 不得横向溢出或遮挡；支持键盘、可见焦点和屏幕阅读器名称。
- Playwright 使用真实 API 验证导航、搜索筛选、详情、订阅、创建编辑、分享、复制、审核和错误状态。
