---
name: coordinator
description: >
  激活条件：用户提到 coordinator、协调者、总控、接管协调、启动协调、多 agent 编排、
  merge 队列、review 门禁、分派 feature 等关键词时触发。
  引导本会话按唯一性握手认领 coord-main 角色，挂监控、跑 SOP 循环、独占合并权。
---

# Coordinator Skill — 启动/运行/退位

> coordinator 是**角色**不是子代理：需要长驻上下文、后台监控、独占合并权，
> 子代理（短命、无监控、无跨回合状态）撑不起来。任何一个会话可以通过本 skill
> 的启动仪式成为**现任 coordinator**；同一时刻全仓最多一个（singleton）。
> 节奏与铁律见 `.harness/instructions/coordinator-sop.md`，本 skill 只管生命周期。

## 何时使用
- 人类让本会话"当总控/接管协调/盯着所有 agent"。
- 现任 coordinator 失联（lease 过期），需要接任。
- 冷启动一个新的协调会话（无任何本地记忆，只靠总线重建状态）。

## 启动仪式（必须按序，不可跳步）

### Step 1 — 唯一性握手（防双 coordinator）
```bash
gh issue list -R <repo> --label coordination:lease --state open --json number
gh issue view <lease-issue> --json comments --jq '.comments[-1]'
```
读 **coordinator lease issue**（label `coordination:lease`，全仓唯一，无则创建）最后一条
heartbeat 评论：
- **lease 新鲜**（< 30 分钟）且非本会话 → **禁止启动**。要么联系现任退位，要么等 stale。
- **lease 过期或无** → 可认领。
- 首次使用：创建该 issue，标题 `[coordination] coordinator lease`，正文写明本文件路径。

### Step 2 — 认领 + 广播
1. 在 lease issue 评论：`coordinator-claim by:<会话标识> at <ISO8601>`。
2. 向存量 worker 会话广播接管通告（跨会话消息或各 in-progress issue 评论），
   声明：verdict 权威、合并独占、worker 不自打 review label。
   > 教训（2026-07-04）：未广播导致双 coordinator 对同一 PR 出具冲突 verdict。

### Step 3 — 冷启动读总线（禁止依赖会话记忆）
```bash
gh issue list --state open --json number,title,labels   # 全量 status:*/agent:*/review:*
gh pr list --state open --json number,statusCheckRollup  # CI 与 review 缺口
```
重建：合并队列、在途 review、changes-requested 欠账、ready-for-dev 待派、lease 巡检对象。

### Step 4 — 挂监控（进入事件驱动）
- L0：60s 轮询 issue label + PR checks 的**变化 diff**（有变化才动作）。
- L2：15min tick 全局巡检；**每个 tick 顺手在 lease issue 发 heartbeat 评论**
  （`coordinator-heartbeat at <ISO8601>`）——这就是唯一性握手的心跳源。

### Step 5 — 进入 SOP 循环
按 `coordinator-sop.md` 的 L0/L1/L2 执行。四条铁律（verdict 权威、coordinator 唯一、
合并独占、证据实测）任何时候不可违反。

## 退位（主动交接）
1. lease issue 评论 `coordinator-release at <ISO8601>` + 交接要点
   （在途 review、冻结原因、未派任务），**状态写总线，不留会话记忆**。
2. 停掉自己挂的监控。
3. 未完成的协调动作降级为 issue 评论，供下任冷启动读取。

## 抢占（现任失联）
- heartbeat 超过 30 分钟：任何会话可评论 `coordinator-takeover at <ISO8601>（前任 heartbeat 过期）`
  后按 Step 2-5 接管。
- 双方同时在场且结论冲突：以 lease issue 上**最新合法 claim** 为准，另一方立即退位；
  已产出的冲突 verdict 以可核验事实重裁（git ls-tree / 退出码 > 打分）。

## 边界（coordinator 不做什么）
- **不写业务代码**（分派给 worker）；例外：≤ 数行的协调平面热修（gitignore、registry、
  生成物重生成）与冲突代解，且合并前自证或过 CI。
- **不跳过自己定的门禁**：coordinator 自己的 PR 同样要 review（可派 reviewer 快检）+ CI。
- **不代持 worker 的 lease**：认领双写是 worker 的动作，coordinator 只巡检回收。
