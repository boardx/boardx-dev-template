---
name: mod-platform
description: >
  激活条件：接到 Platform（平台基建） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# Platform（平台基建） — 模块知识库

> 本文件是 platform 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
队列/工作流/编排/数据层公共设施 + 单机部署形态：packages/data·queue + workflow-worker + infra。

## 代码地图
- 包：`packages/data`（含 migrations + migrate runner）、`packages/queue`（BullMQ）、`packages/agent-core`、`packages/memory`、`packages/tools`
- 进程：`apps/workflow-worker`、`apps/orchestrator`（跑完即退的 CLI，别做常驻服务）
- 部署：`infra/docker-compose.yml` + `infra/DEPLOYMENT.md`（单机手册/runbook）、`scripts/deploy/devapp-update.sh`

## 关键契约与不变量（改代码前必读）
- 架构可移植性是人类硬约束：任何组件不得绑死单一云（devapp=自托管完整栈）。
- 大表迁移走 #530 加固流程（非事务迁移 + CONCURRENTLY + 批处理回填）。
- 数据层仅绑 127.0.0.1，公网只暴露 Caddy（80/443）。

## 关联阶段 / ADR / 文档
infra/DEPLOYMENT.md；#530/#583/#586；ADR-007（docker 清理治理）

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-11：收紧 NOT NULL 前没扫全 INSERT 路径 → 新建 room 500（#586）。迁移加固三件套之外，还要有"写路径普查"这一步。
- 2026-07-10：部署侧网络封出站 22 + sshd socket 激活只绑 IPv6 两个坑，都写进了 DEPLOYMENT.md §1。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
