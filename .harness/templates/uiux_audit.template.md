# UIUX Self-Audit Report — [Feature ID / Page Name]

> 本模板用于走查和审计页面 UI 细节、可用性及信息架构，确保交付物符合 [uiux-standards.md](.harness/instructions/uiux-standards.md) 规定的 Tailwind & shadcn/ui 体验标准。

---

## 1. 审计基础信息

| 维度 | 内容 |
| --- | --- |
| **阶段 / Feature ID** | `phases/0X` / `F0X` |
| **页面/组件名称** | `例如：登录卡片 / 仪表盘侧边栏` |
| **审计智能体** | `uiux-designer` |
| **审计时间** | `202X-XX-XX` |
| **自评总分** | `/ 10` |

---

## 2. 体验自测与评分 (UIUX Checklist)

> 请客观自评以下各维度的完成状态（✅ 优 / ⚠️ 待优化 / ❌ 阻碍体验 / ➖ 不适用）：

### 2.1 视觉与美学层级 (Aesthetics & Hierarchy)

- [ ] **语义配色**：是否完全使用 `bg-background`、`text-foreground`、`border-border` 等 shadcn/ui HSL 语义类？是否有在 Tailwind 中强行硬编码具体色值（如 `bg-[#ff0000]` 或 `text-blue-500`）？
- [ ] **字阶与字重**：页面标题、卡片标题和正文的 Tailwind 字阶比例是否拉开（例如 `text-3xl font-bold` vs `text-sm text-muted-foreground`）？
- [ ] **间距系统**：所有内边距、外边距、元素间距是否采用 Tailwind Spacing Scale (如 `p-4`=16px, `p-6`=24px, `gap-4`)？有无乱用任意值类（如 `p-[17px]`）？布局有无拥挤或不对齐？
- [ ] **圆角与阴影**：是否合理使用了圆角系列（`rounded-md`、`rounded-lg`）与投影（`shadow-sm`、`shadow-md`）以丰富层次？

### 2.2 交互状态与微动效 (Tailwind Interaction States)

- [ ] **状态修饰符覆盖**：所有可交互元素是否都显式配置了 `hover:`、`active:`、`focus-visible:`、以及 `disabled:` 样式？
- [ ] **过渡平滑度**：状态切换是否带有平滑过渡（是否挂载了 `transition-all duration-200 ease-in-out` 等类）？有无生硬瞬变？
- [ ] **焦点聚焦度**：当使用 Tab 键导航时，输入框和按钮的 Focus Ring (`focus-visible:ring-2`) 是否清晰可见、符合无障碍要求？

### 2.3 开发规范与防冲突 (Tailwind Developer Standards)

- [ ] **类名合并 (Class Merging)**：在编写动态状态组件时，是否正确使用了 `cn(...)` 工具函数来做类名合并，消除了 Tailwind 类冲突的隐患？
- [ ] **无生肉 CSS**：是否做到了 100% 零 inline styles（除了极为特殊的动态高度等计算），且没有任何魔改的局部自定义生肉 `.css` 文件？
- [ ] **组件复用**：是否优先复用了 `components/ui/` 下已有的 shadcn/ui 基础组件，避免了重复造轮子？

### 2.4 边界防御 (Edge States)

- [ ] **骨架屏加载**：数据加载态是否使用了 shadcn/ui 的 Skeleton 占位，防止出现剧烈的内容布局偏移（CLS）？
- [ ] **精致空状态**：无内容时是否有配图/图标加引导文案的精致 Empty 状态，而不是空白白板？

---

## 3. 走查发现的体验问题 (Issues & Adjustments)

> 列出本次走查中发现的所有 UIUX 问题，并写明后续的调整计划。

### 🚨 阻碍级体验问题 (Blockers)
*例如：按钮没有 focus-visible 样式，导致键盘导航用户完全看不见当前焦点的所在。*
1. [ ] 问题：
   - 影响：
   - 解决方案：

### ⚠️ 优化级建议 (Suggestions)
*例如：文本使用了 text-foreground，但在暗淡背景下对比度有点偏高，建议降级为 text-muted-foreground。*
1. [ ] 建议：
   - 改进方案：

---

## 4. 交付与对比证据 (Evidence & Showcase)

> 请附上真实的界面截图或视频，作为交付的体验证据（证据应存放在 `evidence/` 目录中）：

*   **改进前效果**（如适用）：`![Before Image](file:///path/to/before.png)`
*   **改进后 / 最终交付效果**：`![After Image](file:///path/to/after.png)`
*   **交互录像证据**（如适用）：`![Interaction Video](file:///path/to/interaction.mp4)`

---

## 5. 走查结论

- [ ] **PASS**（体验流畅，无 Blocker，视觉效果惊艳，符合 Tailwind & shadcn 标准）
- [ ] **REJECT**（存在阻碍性体验问题，需要进一步打磨样式与交互）
