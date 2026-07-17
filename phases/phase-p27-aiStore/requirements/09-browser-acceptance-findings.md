# AI Store 真人浏览器验收修正

## 验收方法

- 使用 Chrome 以 Creator Team、Consumer Team owner、Consumer Team member 和 BoardX 管理员身份逐项操作。
- 使用真实 API、PostgreSQL 数据和页面跳转，不以 mock、静态截图或仅接口响应代替交互验收。
- 覆盖 Explore、详情、订阅、使用、创建、编辑、分享、复制、Team 审核、BoardX 审核、Featured 和响应式布局。

## 已确认问题

1. Explore 将 PostgreSQL `bigint` 字符串 ID 与数字 ID 混用，已订阅资源仍显示 `Not subscribed`。
2. Template 编辑器不能选择源 Board，因此普通用户通过 UI 创建的 Template 无法执行；使用时只得到错误提示。
3. 详情页用 `Team #<id>` 代替来源 Team 名称，与资源列表不一致。
4. 直接打开带 `q` 的 Explore URL 时输入框恢复了搜索词，但首次列表没有执行该搜索。
5. 使用失败等动作错误在切换导航后继续显示，污染无关工作区。
6. 从 Authorized editing 进入编辑器后导航错误变成 Created by me，预览错误显示当前消费 Team，而不是资源来源 Team。
7. `Shared with me` 实际实现的是当前 Team 资源的外发链接和授权管理，名称与交互语义相反。
8. approved/published 资源保存成功后同时提示“实时生效”和“草稿已保存”，状态文案冲突。

## 修正后的用户行为

- Explore 行、详情和 My subscriptions 对同一资源显示一致的个人/Team 订阅状态。
- URL 中的 `q`、`type`、tags 和 page 在首次进入时立即驱动真实查询。
- 行和详情始终优先显示来源 Team 名称。
- Template 编辑器在保存前要求选择当前 Team 的真实源 Board；成功使用后创建独立 Board 并打开。
- Authorized editing 保留授权编辑上下文，编辑预览显示资源来源 Team。
- 切换工作区或成功完成动作后清除上一个动作的错误信息。
- 外发分享管理统一命名为 Shared by me；收到且已兑换的编辑授权统一进入 Authorized editing。
- approved/published 保存成功只提示更改已实时同步给现有订阅者。

## 验收标准

- 新 Playwright 验收使用真实账号、Team、Board 和 AI Store API，先构造资源关系，再通过 UI 验证上述行为。
- 375px、768px 和 1280px 均无横向溢出，主要动作可通过键盘和可访问名称定位。
- 失败状态必须局部呈现并保留当前表单或列表上下文。
