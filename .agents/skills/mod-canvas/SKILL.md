---
name: mod-canvas
description: >
  激活条件：接到 Canvas（画布引擎） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# Canvas（画布引擎） — 模块知识库

> 本文件是 canvas 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
fabric.js 画布：图形/文本/连线/多选/锁定/样式/图表 widget、工具条与快捷键——性能与交互手感是这个模块的命。

## 代码地图
- 包：`packages/canvas`
- 组件：`apps/web/components/board/`（canvas-viewport.tsx、widget 工具条、shortcuts-help）
- e2e：`apps/web/e2e/`（p6 系列 spec）

## 关键契约与不变量（改代码前必读）
- 所有对象操作必须可撤销（undo 栈完整性）。
- 工具条/菜单 z-index 层级契约（#488）。
- 性能基线：大板（>500 对象）拖拽不掉帧——改渲染路径前先跑基线。

## 关联阶段 / ADR / 文档
phases/phase-p6-canvas（sprint 08-10：multiselect/lock/style/text/connector/draw-chart）

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- （待第一条回流——p6 大量经验散在各 sprint handoff 里，值得谁下次进来时归拢）

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
