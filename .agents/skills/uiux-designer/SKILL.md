---
name: uiux-designer
description: >
  激活条件：用户提到 UIUX、用户体验、可用性、页面布局、交互设计、视觉美感、
  暗黑模式、配色、动画过渡、微交互等关键词时触发。
  基于 shadcn/ui 和 Tailwind CSS 的最高美学标准，对前端界面进行体验规划、视觉升级与自主审计。
---

# UIUX Designer Skill (Tailwind & shadcn/ui Edition)

## 何时使用

每当接收到涉及前端 UI 界面、页面布局、用户交互流程、整体视觉美化或体验改进的需求时激活。

该 Skill 的核心目标是：**拒绝简陋、低品质的 MVP 界面，通过 shadcn/ui 及其高度可定制的 Tailwind CSS 体系，构建符合现代最高标准的 Web 体验。**

> 相关规范参考：
> - 设计系统标准：[uiux-standards.md](.harness/instructions/uiux-standards.md)
> - 走查审计模板：[uiux_audit.template.md](.harness/templates/uiux_audit.template.md)

---

## 核心设计与交互准则 (Tailwind & shadcn/ui 实践)

### 1. 极致美学与细节 (Wow-Factor & Theme Mapping)
- **语义化配色**：严禁直接在 Tailwind 中使用硬编码颜色（如 `bg-[#ff0000]`）。必须使用 shadcn/ui 约定的 HSL 语义变量类：
  - 背景与边框：`bg-background`、`bg-card`、`border-border`、`border-input`
  - 前景与文本：`text-foreground`、`text-muted-foreground`、`text-primary-foreground`
  - 核心行动点：`bg-primary`、`hover:bg-primary/90`、`bg-secondary`
- **视觉纵深**：合理运用 `shadow-sm`、`shadow-md` 等 Tailwind 阴影类。在弹窗和浮层上，使用 `backdrop-blur-md bg-background/80` 创造现代的 Glassmorphism 质感。
- **网格与排版**：
  - 页面排版严格符合 Tailwind 的 Spacing Scale (如 `p-4`=16px, `p-6`=24px, `gap-4`=16px) 以对齐 8px 基础网格。禁止使用魔数和无意义的任意值类（如 `p-[13px]`）。
  - 标题使用 `text-3xl font-bold tracking-tight text-foreground` 等拉开字阶与字重。

### 2. 交互状态的完整性
在编写交互组件时，必须利用 Tailwind 的状态修饰符：
- **悬停态 (Hover)**：使用 `hover:bg-accent hover:text-accent-foreground` 或微缩放 `hover:scale-[0.98] transition-all`。
- **点击态 (Active)**：使用 `active:scale-95` 等微交互效果，让按钮感觉是“可按压的”。
- **聚焦态 (Focus)**：必须提供显眼的 `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none` 以支持键盘导航。
- **禁用态 (Disabled)**：使用 `disabled:pointer-events-none disabled:opacity-50`。

### 3. 可用性与状态防御设计
- **Shadcn 组件复用**：在编写页面之前，检查 `components/ui/` 下是否有现成的 UI 基础组件。如果没有，可以建议导入（如 `npx shadcn-ui@latest add [component]`）或自行基于 Radix + Tailwind 规范实现。
- **类名合并最佳实践**：使用 `cn(...)` 工具函数来处理动态类名合并：
  ```tsx
  import { cn } from "@/lib/utils" // 视具体项目的 utils 路径而定
  
  export function CustomCard({ className, active }) {
    return (
      <div className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm transition-all",
        active && "border-primary ring-2 ring-primary/20",
        className
      )}>
        ...
      </div>
    )
  }
  ```
- **边缘状态防御**：
  - 加载中首选 shadcn/ui 的 Skeleton（骨架屏）而非生硬的 Loading 菊花图。
  - 数据为空时设计包含图标、核心说明及 Action 按钮的精致 Empty State 卡片。

---

## UIUX 工作流规范

### 第一步：构思与规划
1. 明确操作主径，优化信息架构，确保主路径无干扰。
2. 梳理需要的 shadcn/ui 基础组件清单。

### 第二步：高标准编码
1. 严格使用 Tailwind utility classes，并配合 `cn(...)` 动态传参。
2. 禁用任何非标准行内样式（如 `style={{ paddingLeft: '17px' }}`）。
3. 确保所有交互逻辑都带有平滑过渡：在主容器或交互元素上应用 `transition-all duration-200 ease-in-out`。

### 第三步：自审与走查 (Self-Audit)
1. 在浏览器中本地渲染预览（使用 `browser_subagent` 或本地命令）。
2. 根据 [uiux_audit.template.md](.harness/templates/uiux_audit.template.md) 逐项自检（是否滥用 Tailwind 任意值、交互是否完整等）。
3. 生成走查截图，编写报告并提交至 `evidence/` 目录归档。
4. 归档后用 `git ls-tree HEAD -- <evidence路径>` 确认截图/报告真的进了 git 树
   （没被 `.gitignore` 挡住）——不在仓库里的证据等于不存在。
5. 界面关键交互元素补齐稳定 `data-testid`，供 e2e/verification 锚定（不锚文案或 DOM 结构）。
