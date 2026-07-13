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
- 2026-07-13：`board-canvas.tsx` 的 `docRef = useRef(createBoardDoc())` 只在组件挂载时初始化一次，但 WS 连接/`load()`/`poll()` 三个 effect 都显式依赖 `[boardId]` 会在 boardId 变化时重跑而不重新挂载组件——`docRef`、`patchQueue`、`undoStack`、`writeGenRef`、`pendingJoinEditsRef` 等一次性 `useRef` 字段都不会随之重置。若未来出现"同一路由组件复用、只切 boardId"的跳转（当前仓库内没有，但没有任何代码层防护），会把新 board 的 items `seedItems` 进旧 board 的 doc（只增不删），造成跨 board 数据串线并广播给对方协作者。已核查现有全部 `/boards/:id` 入口都来自不同路由树、必然触发整体重挂载，故目前不可达，是潜伏缺陷。建议修复：`apps/web/app/(board)/boards/[id]/page.tsx` 给 `<BoardCanvas>` 加 `key={boardId}`，强制 boardId 变化时整体重挂载（复盘产出，尚未开 PR，board 侧评估是否现在修）。
- 2026-07-10：硬编码 `ws://host:3001` 在 HTTPS 生产被混合内容策略拦死（#537 修复）——凡下发 URL 的端点都要想"经过反代/TLS 后还成立吗"。
- 2026-07-08：`reconcileLocalEdits`（join-sync 完成时把本地编辑补写进 doc）必须传"调用方已确认真的编辑过"的字段级 patch（`{id, fields}`），不能传整条 item 快照——即使某 id 确实有过本地编辑，若把它未曾触碰、可能落后于对等端的其它字段也一起覆盖，会把对等端刚经 `applyEncodedUpdate` CRDT 合并进来的更新覆盖回旧值，等价于把 #432 的病灶从 REST-poll 轴换到 join-sync 轴复现（首轮 review 抓到，出处：PR #464，issue #463）。
- 2026-07-08：item **创建**走 `upsertItem` 直写 doc 会立即把 `_rev` 顶到 >0；但样式**编辑**若只走常规 `[items]` effect 落 doc（被 `joinSyncedRef` 门禁挡住，join-sync 完成前不能写 doc），会在 join-sync 完成时被 `seedItems` 的"`_rev>0` 就跳过"规则误伤，把 join 前的本地编辑回滚——`_rev` 门禁的设计前提是"doc 比 REST 快照新"，套到"本地未落 doc 的编辑 vs doc"这组关系上恰好反了（出处：PR #462，issue #414，e2e 复现见 `widget-text.spec.ts:40`）。
- 2026-07-08：`seedItems` 对已存在条目按 `_rev` 门禁裁决覆盖权——`_rev===0` 才允许 REST 快照覆盖，`_rev>0` 视为"有过有意编辑"跳过；这是 #432 竞态（创建后立即 PATCH、被过期 poll 快照卡死）的根治点。后续任何往 doc 里写"可能滞后"数据的新代码路径，动手前先想清楚该走 `seedItems`（保守，只补新条目/未编辑字段）还是 `upsertItem`/`reconcileLocalEdits`（明确本地已知更新，无条件写）（出处：PR #442，issue #432）。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
