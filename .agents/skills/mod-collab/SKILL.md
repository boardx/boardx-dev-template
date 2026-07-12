---
name: mod-collab
description: >
  激活条件：接到 Collaboration（实时协作） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# Collaboration（实时协作） — 模块知识库

> 本文件是 collab 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
Yjs 多人同步：collab-gateway WS 服务、在线状态/光标，以及生产部署形态（反代 + wss）。

## 代码地图
- 包：`packages/collab`（Yjs 封装）
- 网关：`apps/web/server/collab-gateway.mjs`（独立 Node 进程 :3001，systemd boardx-collab）
- 配置端点：`apps/web/app/api/collab/config/route.ts`（含 3 条单测）

## 关键契约与不变量（改代码前必读）
- WS URL 由 /api/collab/config 下发：`COLLAB_WS_PUBLIC_URL` 覆盖（生产 wss 反代）> 按请求协议推导（#537）。
- 网关的 upgrade 握手是唯一鉴权点（isAuthenticated），config 端点本身不做鉴权（URL 非敏感）。
- 共享 checkout 隔离（ADR-005）对本模块尤其重要——网关是常驻进程，别在共享目录切分支。

## 关联阶段 / ADR / 文档
phases/phase-p8-collaboration；infra/DEPLOYMENT.md §4（Caddy WS 路由）

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-10：硬编码 `ws://host:3001` 在 HTTPS 生产被混合内容策略拦死（#537 修复）——凡下发 URL 的端点都要想"经过反代/TLS 后还成立吗"。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
