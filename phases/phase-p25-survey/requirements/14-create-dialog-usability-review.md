# 14 — 新建问卷弹窗可用性优化

## 事实来源

- 用户于 2026-07-18 提供的 `/surveys` 实际页面弹窗标注截图：
  `codex-clipboard-35359234-5b38-48a5-949a-8bc2b460bf35.png`。
- 用户确认采用方案 A：保留参考 HTML 的三入口卡片，但扩大弹窗并补齐信息层级与行动提示。
- GitHub 交付入口：`boardx/boardx-dev-template#693`，追踪 issue：`#648`。
- 本需求是 F15 Delivery PR 合并前的 review 返工，不创建第二个 Delivery PR。

## 当前问题

- `Dialog` 默认 `max-w-md` 无法容纳三列入口卡片，卡片有效宽度不足。
- `Button` 基础样式的 `whitespace-nowrap` 传递到多行说明，造成文字截断和跨卡片重叠。
- 三张卡片高度固定但缺少明确行动文案，空白较多，用户难以快速比较三种创建路径。
- 移动端需要在有限高度内完整阅读和操作，不能依赖桌面三列压缩。

## 已确认设计

### 1. 弹窗与信息层级

- 弹窗桌面端最大宽度约 720px，保持居中、8px 圆角、语义边框与阴影。
- 标题与说明保持在弹窗头部；关闭按钮继续支持点击、Esc 与焦点恢复。
- 内容区保留三个入口：AI 对话生成、从模板开始、空白问卷。

### 2. 创建入口卡片

- 每张卡片按“图标、标题、完整说明、行动文案”排列，说明文字必须自然换行。
- AI 对话生成显示“推荐”徽章，保持 Survey 紫色语义强调，但三个入口均为完整可点击目标。
- 行动文案分别为“开始对话”“浏览模板”“从空白开始”，配合方向图标表达将进入下一步。
- hover、active、focus-visible 状态完整，不使用文字截断或固定单行来表达层级。

### 3. 响应式与无障碍

- 桌面端三列等宽展示；移动端自动改为单列紧凑卡片。
- 弹窗内容超过可视高度时允许弹窗内部滚动，页面本身不产生横向溢出。
- 打开后默认聚焦首个推荐入口；三个入口继续使用稳定的现有 `data-testid`。

## 不变契约

- `new-survey-ai`、`new-survey-template`、`new-survey-blank` 的业务回调和目标页面不变。
- 不修改问卷创建、模板加载、AI 会话、owner/team/room 权限或后端 API。
- 遮罩点击、Esc 关闭、Tab 焦点圈定与关闭后焦点恢复继续由共享 `Dialog` 提供。

## 验收

- 桌面视口打开 `new-survey-dialog` 后，面板宽度足以容纳三列卡片，所有说明均在自身卡片内换行。
- 三张卡片显示对应行动文案，AI 卡片显示“推荐”。
- `390 x 844` 视口中卡片单列展示，弹窗与页面均无横向溢出，三个入口均可滚动到并操作。
- `pnpm --filter @repo/web run lint`
- `pnpm --filter @repo/web run typecheck`
- `pnpm --filter @repo/web exec playwright test e2e/survey-p25-015-home-information.spec.ts e2e/survey-p25-015-create-dialog.spec.ts`
- `pnpm harness doctor --phase p25`
