---
name: mod-ava
description: >
  激活条件：接到 AVA（AI 对话与深度研究） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# AVA（AI 对话与深度研究） — 模块知识库

> 本文件是 ava 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
AVA 对话：线程/消息/Deep Research（双模板报告）/建议动作/语音；AI 网关与订阅能力位于 packages/ai。

## 代码地图
- 页面：`apps/web/app/(app)/ava/page.tsx`（大文件，研究类型选单等都在这）
- API：`apps/web/app/api/ava/`（threads/research 等）
- 包：`packages/ai`（gateway.ts、researchGenerator.ts）；研究会话表 027/028 迁移

## 关键契约与不变量（改代码前必读）
- ANTHROPIC_API_KEY 缺失 = 诚实降级（capabilities 端点不 500，#531）。
- researchType 贯穿：composer 选择 → research_payload.report.researchType → 刷新恢复（p18-F14）。
- 调模型只经 packages/ai 网关，页面层不直连 Anthropic。

## 关联阶段 / ADR / 文档
phases/phase-p9-ava-chat、p18-ava-ai-realization、p21-ava-canvas-memory-expansion

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-12：研究类型按钮黑底黑字——`variant="default"` + 表外字号 text-12 被 tailwind-merge 吞配色（ADR-013 根治）。UI 改动记得跑 lint-design。
- 2026-07-11：订阅查询失败曾拖垮 capabilities 端点（#531）——外部依赖失败一律降级到内置默认。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
