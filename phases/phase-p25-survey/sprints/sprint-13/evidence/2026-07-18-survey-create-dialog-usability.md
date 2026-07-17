# F15 新建问卷弹窗可用性验收

## 来源与范围

- 用户 review 截图：`source-create-dialog-usability.png`
- 同比例来源图：`source-create-dialog-usability-1624.png`
- 实现截图：`survey-create-dialog-f15-desktop.png`
- 并排对比：`comparison-create-dialog-f15.png`
- 比较尺寸：每侧 `1624 x 934`，同为 `/surveys` 首页打开“新建问卷”弹窗的状态。

本次仅优化三种创建方式的选择弹窗，不改变 AI、模板或空白问卷的目标流程。

## 问题复现

- 测试先行时桌面弹窗实测宽度为 `448px`，低于验收要求的 `680px`。
- 三列按钮继承 `whitespace-nowrap`，长说明无法在自身卡片中换行。
- 原弹窗没有明确行动文案，也没有用“推荐”解释 AI 卡片的紫色强调。

## 实现结果

- 弹窗使用 `max-w-3xl`，桌面端三张卡片等宽且说明自然换行。
- 每张卡片显示图标、标题、完整说明和下一步动作；AI 卡片显示“推荐”。
- 移动端改为单列紧凑布局，弹窗允许内部滚动，页面与卡片均无横向溢出。
- Dialog 首焦点声明改用稳定的 `data-dialog-autofocus`，保留 Esc、Tab 圈定与关闭后焦点恢复。

## 自动化断言

`survey-p25-015-create-dialog.spec.ts` 覆盖：

- 桌面弹窗宽度不小于 `680px`。
- 三张卡片均为 `white-space: normal` 且 `scrollWidth <= clientWidth + 1`。
- 三个行动文案和 AI 推荐标记可见。
- 打开弹窗后 AI 推荐入口获得首焦点。
- `390 x 844` 下三张卡片单列对齐，弹窗、卡片和文档均无横向溢出。

聚焦测试结果：`2 passed`。

## 最终验证

- F15 首页与弹窗组合回归：`6 passed`。
- Survey 八规格完整回归：`40 passed`。
- Web 单元测试：`22 files / 109 tests passed`。
- 仓库基础门禁：`58 tasks passed`。
- Harness F15 evidence backfill：通过。
- Harness doctor：`0 FAIL / 0 WARN`。

## 视觉判断

- P0：无。
- P1：原有文字跨卡片重叠已消除。
- P2：原有信息层级不清和大块无意义空白已消除；行动提示与推荐关系清晰。
- P3：实现截图使用新注册的空数据账号，因此背景中的问卷数量与用户截图不同，不影响弹窗布局验收。

结论：通过。
