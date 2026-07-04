# 原始需求 — Profile/Home 文档与追踪同步（Phase p21）

## 背景 / 为什么做
Profile（p1）和 Home（p2）两个域的骨架和 e2e 断言本身是扎实的，问题集中在**需求文档/功能清单
与真实实现不同步**，不是代码缺陷：
- p2-F04（`/recent` 占位页）标 `passing`，但其 `verification` 命令指向的
  `e2e/recent-placeholder.spec.ts` 在仓库中不存在；真实存在且未被引用的
  `home-004-view-recent-page.spec.ts` 测的是一个真实填充的最近白板列表，断言内容与 F04 的
  `user_visible_behavior`（"不展示资源卡片/列表"）直接相反——需求文字滞后于真实 UI 改版。
- p1 `requirements/README.md` 声称 aiModel/privacy 字段"来自 oldcode"，但核实 oldcode 的
  User 实体（`user.entity.ts`）根本没有这两个字段，是全新设计而非移植，溯源描述本身是错的。
- p2-F03/F06 的 blocked_on 表述是笼统的"p9/p11 未接通"，但核实后 p9-F01、p11-F01/F02 早已
  passing，真正卡住的是更具体的 p11-F03（Agent→AVA 桥接），表述已经过时。

## 原始需求（用户故事 / 大白话都行）
- 作为下一个接手这两个 phase 的 agent/工程师，我想要 feature_list.json 的字段（尤其是
  verification 命令和 blocked_on 依据）和真实代码状态一致，以便不会被过时的文字误导做出
  错误判断。

## 验收线索（可观察的成功是什么样）
- p2-F04 的 `verification` 改为指向真实存在的测试文件（先确认产品对"占位页 vs 真实列表"这个
  UI 分歧的最终决定，再让 `user_visible_behavior` 与之对齐，而不是简单地把命令路径改对就完事）。
- p1 README 的 oldcode 溯源描述改为如实说明"aiModel/privacy 是本阶段新设计，非 oldcode 移植"。
- p2-F03/F06 的 notes 里的 blocked_on 更新为精确的 `p11:F03`。

## 范围与边界
- 本阶段要做：以上三处文档/清单字段修正，工作量很小，合并成一个 feature。
- 明确不做：oldcode 首页里有但当前完全没规划的能力（最近使用 Agent 遥测、Tutorials 轮播、
  Onboarding 导览、团队仪表盘）——这是新功能范畴，需要产品单独排期，不属于"加固/修文档"性质，
  不放进本阶段；aiModel/privacy 偏好接入下游消费（AVA/Board 默认值）——同样是新功能，不做。

## 已知约束 / 依赖
- 无特殊安全/能力平面依赖，纯文档+feature_list 字段修正+可能的测试文件路径修正。

## 切分提示（给 requirement-author 的建议）
- 这是本阶段里优先级最低、风险最小的一个 feature，可以合并 p1+p2 的所有文档修正为一个 feature，
  不需要拆分；不需要过 rev-security。
