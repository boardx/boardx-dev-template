# Agent 扩容 — 激活配套文档（2026-07）

> 维护者：architecture-coordinator（同 `agent-onboarding-checklist.md`）
> 这是一份**带时间戳的补充文档**，配合 `agent-onboarding-checklist.md`（永久性、平台无关的
> 协议本体）使用，回答"现在要扩容，具体加在哪、新 agent 第一天该做什么"。协议本身的规则
> 一律看 checklist，不在这里重复。

## 1. 目的与范围

本文档只回答一个问题：**这一轮扩容，具体往哪加人、新 agent 第一天怎么开始**。永久性的
协作规则（身份来自 registry.yaml、原子双写认领、evidence-gated passing、coord-main 独占
合并权等）一律看 `agent-onboarding-checklist.md`，本文档不重复。

## 2. 当前花名册与建议新增

现有 registry.yaml（约 28 条）：1 coordinator（coord-main）、1 architecture-coordinator、
7 module-coordinator（room/board/collab/ava/store-admin/survey/platform）、约 14 个
worker、4 个 reviewer。

**建议新增（提案，非直接执行）**：

- **`wrk-board-shell-1` / `wrk-board-shell-2`**（新增，area: `[board-header, board-menu,
  context-menu]`，reports_to: `coord-board`）——根因：`phases/phase-p7-board-shell/
  feature_list.json` 现状 8 个 `not_started` + 5 个 `blocked` + 3 个 `passing`（共 16 个
  feature），是当前 backlog 里缺人最明显的地方。

- **ai-store 暂不建议加人**：`phases/phase-p11-ai-store/feature_list.json` 现状 5 个
  `passing` + 1 个 `in_progress`（共 6 个），相对健康，现有 `wrk-store-1`/`wrk-store-2`
  应该够用，除非用户特别想加快 F03 的收尾。

**这仍然是一份提案**：按 `agent-onboarding-checklist.md` 的规则，新增身份是 schema 变更，
要走 registry.yaml 的 PR + review，不因为写在这份文档里就自动生效。具体加几个、加在哪，
最终由用户/coord-main 拍板后再走 PR。

## 3. 用新 dashboard 辅助激活

完成 `agent-onboarding-checklist.md` 的阅读清单后，新 agent（或人类）可以打开
`/admin/coordination`（见 `agent-lifecycle-management-proposal.md`）查看当前认领/
review 队列/lease 状态，再决定认领哪个 issue——这是对 `gh issue list` 临时查询的补充，
不是替代。**v1 是只读的，没有一键认领按钮**，认领仍然要走 `pnpm harness claim` +
`gh issue edit` 的原子双写。

## 4. coord-service 现在还不开放给新 agent——明确门禁

**明确声明**：coordinator 层级往 D1 dual-write 切换目前暂停，等（a）3 个已知修复落地
（`queryActiveClaim` 静默 fail-open 改带标签结果类型、module-lock heartbeat 格式补文档、
projector 的 `role:coord-*` 映射缺口）、（b）一轮干净 soak 完成之后才会推进。**新 agent
——不管是 worker 还是 reviewer——一律只用 GitHub label 协调**（现成的 `status:*`/
`agent:<id>` 状态机），没有人现在应该被发放 `COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN`。
写这一条是为了防止新 agent 读了 ADR-006 觉得原子锁机制很酷，就自己提前接上——现在接了
也没有实际收益，反而会在 3 个修复还没落地时暴露已知的 fail-open bug。

## 5. 新 agent 第一天检查清单（这一轮扩容专属，具体、有时效）

1. 确认自己的 registry.yaml 条目已存在（或已通过第 2 节的 PR 加上）。
2. 完整读 `agent-onboarding-checklist.md`（链接过去，不重复内容）。
3. 查看 coordination dashboard（或 `gh issue list --label area:board-header --label
   area:board-menu --label area:context-menu --label status:ready-for-dev`）找到自己
   area 里当前未认领的工作。
4. 当前 backlog 快照（写作本文档时的数字，后续会变，别当永久事实）：p7-board-shell 共
   16 个 feature，8 个 not_started、5 个 blocked、3 个 passing；board-header/board-menu/
   context-menu 这几个 area 现在缺人。
5. 认领 `ready-for-dev` 的第一件事是原子双写（`agent:<id>` + `status:in-progress`
   label），不是私下发消息给谁。

## 6. 待决策事项（本文档假设仍待人类确认，不代表已拍板）

- 具体新增几个 worker、精确 ID 叫什么——第 2 节只是建议方向。
- reviewer 产能是否也要扩（目前只有 4 个 reviewer，`rev-code`/`rev-feature` 的
  `required_for: "*"` 意味着覆盖全仓，扩容 worker 数量后可能成为瓶颈）——本轮暂未纳入
  提案范围，需要用户明确是否要一起扩。
- coord-service 的 3 个修复何时落地、soak 何时完成——本文档写成"问 coord-architecture
  要最新进展"而不是写死具体日期，避免修复一落地这份文档就过时。
