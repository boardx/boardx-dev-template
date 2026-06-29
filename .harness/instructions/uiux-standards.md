# UIUX 视觉设计与交互规范 (Tailwind CSS & shadcn/ui Standard)

本规范是 BoardX 设计系统的权威指引。**规范里加粗的"必须/严禁"条目同时是 harness 门控条件**——
`lint-design.sh` 会机器检查，违反会让 verify 失败。

---

## 0. Feature UI 完成定义（DON）——写功能前先过这张清单

一个 UI feature 必须同时满足以下条件才可标为 passing：

| # | 条件 | 验证方式 |
|---|------|----------|
| U1 | **有 loading 状态**：数据加载期间展示 skeleton 或带 `data-testid="loading"` 的占位区，不能是空白 | lint-design.sh 自动检查 |
| U2 | **有 empty state**：列表/内容为空时有引导文案或图示（`data-testid="empty"`），不能是空白区域 | e2e spec 断言 |
| U3 | **有 error state**：fetch 失败/验证错误有结构化展示（`data-testid="err-*"`），不能静默失败 | e2e spec 断言 |
| U4 | **微交互完整**：所有可点击元素有 `hover:` + `transition-*`，输入框有 `focus-visible:ring-2` | lint-design.sh 自动检查 |
| U5 | **无硬编码颜色/像素**：只用语义 token，不用 hex/palette 色，不用 `[Npx]` | lint-design.sh 自动检查 |
| U6 | **无原生表单元素**：app/ 层禁止裸 `<input>`/`<select>`/`<button>` | lint-design.sh 自动检查 |
| U7 | **无障碍基础**：`<img>` 有 `alt`，表单控件有 `<Label>` 或 `aria-label`，焦点环不被裸 `outline-none` 消除 | lint-design.sh 自动检查 |
| U8 | **响应式布局**：至少在 375px/768px/1280px 三档不出现横向溢出 | Playwright viewport 检查 |

---

## 6. 状态模式（State Patterns）——每个 UI feature 必须实现

### 6a. Loading Skeleton（必须）

```tsx
function LoadingSkeleton() {
  return (
    <div data-testid="loading" className="flex flex-col gap-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-muted" />
      ))}
    </div>
  );
}
```

### 6b. Empty State（必须）

```tsx
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div data-testid="empty"
      className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-12 text-center">
      <p className="text-sm text-muted-foreground">还没有内容，创建第一个试试</p>
      <Button size="sm" onClick={onCreate}>新建</Button>
    </div>
  );
}
```

### 6c. Error State（必须）

```tsx
{error && (
  <p role="alert" data-testid="err-form" className="text-sm text-destructive">
    {error}
  </p>
)}
```

### 6d. Success Feedback（必须）

```tsx
{saved && (
  <p data-testid="saved" className="text-sm text-success transition-opacity duration-300">
    已保存
  </p>
)}
```

---

## 7. 表单规范（无障碍必须）

```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="email">邮箱</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
    aria-describedby={error ? "email-error" : undefined}
  />
  {error && (
    <p id="email-error" role="alert" className="text-xs text-destructive">{error}</p>
  )}
</div>
```

提交按钮必须有 `disabled={submitting}` 防止重复提交。

---

## 8. 附：agent 提交前自检清单

```
□ U1 loading skeleton 已实现（data-testid="loading"）
□ U2 empty state 已实现（data-testid="empty"）
□ U3 error state 已实现（role="alert" + data-testid="err-*"）
□ U4 所有 hover: 都有对应 transition-*
□ U5 无硬编码 hex/palette 颜色，无 [Npx]
□ U6 无裸 <input>/<select>/<button>（app/ 层）
□ U7 <img> 有 alt；表单控件有 Label 或 aria-label
□ U8 pnpm lint-design 本地通过
```

---

本规范为 BoardX 项目的核心设计系统指引，旨在指导所有 Agent 和开发人员在编写 React 组件时，遵循统一的、符合 **Tailwind CSS 与 shadcn/ui** 约定的世界一流体验标准。

---

## 1. 配色系统 (Tailwind & HSL Semantic Colors)

**原则**：严禁硬编码高对比度的原生颜色或纯色（如 `text-[#ff0000]`）。优先使用下述 shadcn/ui 标准 HSL 语义类，保证暗黑模式和亮色模式能自动优雅切换。

| 类别 | Tailwind 类名 | 对应 HSL 变量含义 | 推荐使用场景 |
| --- | --- | --- | --- |
| **基础背景** | `bg-background` | `--background` | 页面主背景 |
| **卡片背景** | `bg-card` | `--card` | 独立板块、卡片容器背景 |
| **主文本色** | `text-foreground` | `--foreground` | 页面正文、标题等高对比度文本 |
| **暗淡文本** | `text-muted-foreground` | `--muted-foreground` | 副标题、注释、辅助说明 |
| **边框颜色** | `border-border` | `--border` | 卡片分界线、轻量分栏线 |
| **输入框边框** | `border-input` | `--input` | 表单输入框、按钮边框 |
| **主强调色** | `bg-primary` `text-primary-foreground` | `--primary` / `--primary-foreground` | 主行动点按钮（Primary CTA）背景和文字 |
| **次强调色** | `bg-secondary` `text-secondary-foreground` | `--secondary` / `--secondary-foreground` | 次级按钮、标签背景 |
| **警示/破坏** | `bg-destructive` `text-destructive-foreground` | `--destructive` | 危险操作按钮（如删除、退出） |
| **发光圈** | `ring-ring` | `--ring` | Focus 状态时的外发光 |

---

## 2. 间距与网格 (Tailwind Spacing Scale)

**原则**：严格基于 **8px/4px 基础网格系统**。直接采用 Tailwind Spacing 预设值，**严禁滥用任意值类（如 `p-[11px]`、`m-[23px]`）**，确保界面的排版节奏具备呼吸感与一致性。

- **4px / 8px 律动节奏**：
  - `p-1` (4px)：极其紧凑的内边距，如微章、小图标容器。
  - `p-2` (8px)：紧凑内边距，如小按钮、标签项。
  - `p-4` (16px)：标准内边距，适用于大多数列表项、子卡片。
  - `p-6` (24px)：大内边距，用于外层主卡片、模块间距。
  - `gap-4` (16px) / `gap-6` (24px)：网格或 flex 布局的经典元素间距。
  - `space-y-4` / `space-x-4`：在垂直或水平流中，对齐 8px 律动的最佳选择。

---

## 3. 字体与层级 (Typography)

**原则**：利用 Tailwind 预设的 font-size、font-weight 和 letter-spacing，形成极佳的信息阶梯（Information Hierarchy）。

- **页面标题 (Page Title)**:
  `text-3xl font-bold tracking-tight text-foreground`
  *(即 1.875rem / 30px，粗体，略微收缩字距)*
- **卡片/区块标题 (Section Title)**:
  `text-xl font-semibold text-foreground`
  *(即 1.25rem / 20px，半粗体)*
- **正文 (Body Text)**:
  `text-sm text-foreground leading-relaxed`
  *(即 0.875rem / 14px，适当行高增加舒适度)*
- **辅助说明 (Caption/Muted)**:
  `text-xs text-muted-foreground font-medium`
  *(即 0.75rem / 12px，弱化显示，语义清晰)*

---

## 4. 圆角、阴影与质感 (Radius, Shadow & Glassmorphism)

- **圆角规范 (Border Radius)**：
  - `rounded-sm` (2px): 极小细节（如复选框）。
  - `rounded-md` (6px / `var(--radius) - 2px`): 标准按钮、输入表单。
  - `rounded-lg` (8px / `var(--radius)`): 卡片主容器、对话框。
  - `rounded-full` (9999px): 头像、药丸式胶囊 Tag。
- **阴影规范 (Shadow)**：
  - 常规卡片：使用 `shadow-sm`。
  - 悬浮/交互容器：使用 `shadow-md`。
- **现代毛玻璃效果 (Glassmorphism)**：
  - 用于下拉浮层、悬浮对话框：
    `bg-background/80 backdrop-blur-md border border-border/50 shadow-lg`

---

## 5. 状态微交互与动效 (Tailwind Transition & States)

**原则**：没有动效的交互是生硬的。使用 Tailwind 的状态修饰符配合 Transition，提供顺滑、高级的反馈。

- **基础过渡声明**：
  在所有可变样式的组件上应用：`transition-all duration-200 ease-in-out`。
- **悬停效果 (Hover)**：
  - 按钮/卡片悬浮：`hover:bg-accent hover:text-accent-foreground`。
  - 缩放动画：`hover:scale-[0.98] active:scale-95`。
- **聚焦高光 (Focus-Visible)**：
  - 严禁完全隐藏 focus outline 而不作替代。
  - 规范的输入框 Focus Ring 写法：
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- **类名动态合并规约**：
  在拼接包含外部 `className` 和内部动态状态的类名时，**必须**调用 `cn(...)` 工具函数（利用 `clsx` 和 `tailwind-merge` 消除类名冲突）：
  ```tsx
  import { cn } from "@/lib/utils"
  
  export function Button({ className, variant, ...props }) {
    return (
      <button 
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          className
        )}
        {...props}
      />
    )
  }
  ```
