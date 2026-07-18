---
name: mod-harness
description: >
  激活条件：接到 Harness（控制平面） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# Harness（控制平面） — 模块知识库

> 本文件是 harness 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
开发过程本身的基础设施：feature 门控/verify/doctor/lock/sync CLI、协作协议文档、coord 平台（coord-gateway/RepoHub/protocol）——本模块的用户是全体 agent 和人类开发者。

## 代码地图
- CLI：`.harness/scripts/`（verify/doctor/claim/lock/module-lock/sync…）
- 协议文档：`.harness/instructions/`；ADR：`docs/adr/`（#596 起全局目录,含索引）
- 协调平台：`apps/coord-gateway` + `packages/coord-repohub|coord-protocol|coord-projection`（ADR-017）+ `packages/coord-dashboard`；旧 `packages/coord-service` 已删除（2026-07-18 割接，D1 归档在 p29 evidence/d1-final-archive）

## 关键契约与不变量（改代码前必读）
- passing 只能由 `verify --sprint` 翻转（ADR-012 D5）；证据必须真实落盘且进 git。
- doctor 是审计链权威（pre-push 按触碰 phase 门控）。
- 协调权威在 coord-gateway/RepoHub DO（ADR-009 语义 + ADR-017 载体）；属主判定信 token 不信 --session（#502）。
- 改门控工具本身 = 高危变更，需要显式授权，绝不悄悄改。

## 关联阶段 / ADR / 文档
ADR-001/003/005/009/010/011/012/013；docs/postmortems/postmortem-p23-false-passing.md；coordinator-sop.md

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-18：协调层割接 coord-gateway（p29-F10，ADR-017）——`packages/coord-service` 整目录 + `deploy-coord-service.yml` 删除，`COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN` 全面退役；lock-*/module-lock-*/tick/cycle-report 一律走 `COORD_GATEWAY_URL`/`COORD_API_TOKEN`/`COORD_REPO`（参考客户端 `@repo/coord-protocol/client`）。ADR-014 权威时钟迁到 gateway `GET /api/coord/time`（cycle 计算逐行搬运，语义零变更）。D1 审计史归档 `phases/phase-p29-coord-platform/evidence/d1-final-archive/`（agents 已剥离 token_hash——public 仓不入库凭据派生物）。
- 2026-07-17：coord-service 补了 CD（deploy-coord-service.yml，Closes andon #272/#290 根因）。此前它是**唯一没有 CD 的部署目标**，手动 wrangler deploy → 两个分支 last-write-wins 互相覆盖（#629 部署覆盖掉 #614 的 tasks 路由，线上收件箱静默消失）。CD 只从 main 部署、串行不取消，从根本消除竞争；冒烟检查带**部署漂移探针**（/time 存在 + /tasks 返 401 而非 404）。铁律推论：**协调权威绝不手动部署**，改代码走 PR 合 main 触发 CD。
- 2026-07-10：P23 假 passing 事件——verify --phase 模式断审计链（postmortem 全文必读）。
- 2026-07-10：doctor 首跑全仓 85 FAIL——手抄清单/人肉纪律必然漂移，能机器判定的绝不留给人。
- 2026-07-11：#545 合错 base + force-push 丢 workflow（#547 恢复）——工作流类文件合并后要验 main 树。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
