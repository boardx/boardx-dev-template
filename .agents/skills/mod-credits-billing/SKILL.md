---
name: mod-credits-billing
description: >
  激活条件：接到 Credits / Billing（额度与计费） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# Credits / Billing（额度与计费） — 模块知识库

> 本文件是 credits-billing 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
钱包/额度/支付回调（webhook fail-closed）/订阅——敏感 area，强制安全评审。

## 代码地图
- 页面：`apps/web/app/(app)/credits/`、`(app)/billing/`、`payment-test/`
- 组件：`apps/web/components/credits/`、`components/billing/`
- Webhook 鉴权：`apps/web/lib/webhook-auth.ts`（WEBHOOK_SECRET fail-closed）

## 关键契约与不变量（改代码前必读）
- **billing 是敏感 area**：一切 PR 强制过 rev-security（agent-onboarding-checklist 规则 7）。
- webhook 校验 fail-closed：未配置或不匹配一律拒绝，防伪造"支付成功"。
- 迁移回填禁止自然键匹配（PR #312 初版教训，coordinator-sop 分诊表）。

## 关联阶段 / ADR / 文档
phases/phase-p14-credits-billing；.env.example WEBHOOK_SECRET 注释

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07（历史）：迁移回填用 name 匹配差点混入用户数据（#312）——回填只认不可变主键。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
