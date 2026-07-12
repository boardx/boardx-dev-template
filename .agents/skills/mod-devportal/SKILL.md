---
name: mod-devportal
description: >
  激活条件：接到 DevPortal（协作平面门户，develop.boardx.us） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# DevPortal（协作平面门户，develop.boardx.us） — 模块知识库

> 本文件是 devportal 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
独立自包含 app（apps/devportal）：Cloudflare Pages + Access 门禁，展示本仓开发状态（P23 五板块的协作面版本）。

## 代码地图
- 全部代码：`apps/devportal/`（零 @repo 依赖、零越界 import——刻意自包含）
- 适配层：`lib/access.ts`（Access JWT 验签）、`lib/repo-files.ts`（GitHub Contents 替代 fs）、`lib/portal-fetch.ts`（401 自动重认证）
- 部署：`wrangler.toml`（唯一配置事实源）+ CD deploy-devportal.yml

## 关键契约与不变量（改代码前必读）
- 与产品面 portal 是**有意的双份**（数据源/门禁不同），不共享代码。
- 必须验 Access JWT，不能裸信 email 头（pages.dev 直连可伪造）。
- **compatibility_date ≥ 2024-11-11**（fetch cache 选项门槛，2026-07-12 全站事故）。
- 云端 env 变更与部署必须原子（先加后删/同 PR），CD 活跃时先删后合会被踩中。

## 关联阶段 / ADR / 文档
issue #523/#543；wrangler.toml 头注；apps/devportal/README.md

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-12：compatibility_date 2024-11-01 < cache 选项门槛 → 所有出站 fetch 抛异常，全数据源 unreachable（#593）。toml 入仓沿用项目现值，别抄模板。
- 2026-07-11：先删 secrets 等 toml 接管，被 CD 中途部署踩中断供——env 变更原子性（记忆已固化）。
- 2026-07-12：Access 会话过期（24h）曾被渲染成"数据源不可达"（#588 修复：401 自动整页重认证）。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
