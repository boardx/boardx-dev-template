# 原始需求 — WebSocket + Redis 广播骨架（不含 Yjs 逻辑）

> 背景调研见 `phases/requirements/board-canvas-gap-analysis-and-roadmap.md` Wave 0 第 4 项。
> 现有 `phase-p8-collaboration/feature_list.json` 的 F01（Yjs 实时同步组件变更）notes 里
> 已经写了"新建 packages/collab：每 Board 一个 Yjs doc + WebSocket provider + Redis
> fanout"，即传输层骨架本来就是 F01 范围的一部分。本文件的目的是把"能收发消息的裸传输层"
> 拆成一个更小的独立可验证增量，排在 F01（真正的 Yjs CRDT 同步语义）之前，降低 F01 一次要
> 交付的范围（新起服务/网关 + CRDT 语义耦合在一起验证起来更慢、更难定位问题）。

## 背景 / 为什么做
`infra/docker-compose.yml` 已经有 Redis（`packages/queue` 也已经在用它做 BullMQ），但仓库里
没有任何 WebSocket 网关代码（`apps/web`、`apps/orchestrator`、`apps/workflow-worker` 都不是
长连接服务）。P8 的四个 feature（Yjs 同步/在线光标/跟随视角/断线重连）全部依赖这个传输层
存在，如果直接从 F01 开始做，"起一个新服务"这类基础设施发现成本会和"Yjs 数据建模"这类
业务逻辑成本混在一起，一次验证周期里要解决太多未知数。

## 原始需求（用户故事）
- 作为开发者，我想要有一个可独立起停的 WebSocket 网关（可以是 `apps/web` 的一个 route
  handler/自定义 server，或 `apps` 下新增的轻量服务，具体技术选型留给实现时决定），客户端
  能建立连接、发送消息、收到网关广播回来的消息。
- 作为开发者，我想要这个网关把收到的消息发布到 Redis pub/sub 的一个 channel，并让所有订阅
  该 channel 的网关实例都能广播给自己连接的客户端——这样多实例部署时消息能跨实例扩散，不是
  单进程内存广播（现有 `lib/presence.ts`/`lib/collab-bus.ts` 就是内存态，撑不住多实例）。
- 作为开发者，我想要这一步不涉及任何 Yjs/CRDT 语义——消息内容是什么、怎么合并状态，全部留给
  F01（现有 p8:F01）处理；这里只验证"消息能从一个客户端经网关+Redis 到另一个客户端"。

## 验收线索
- 两个客户端（可以是两个 Playwright browser context 各开一个 WS 连接，或一个简单的测试脚本）
  连接同一个 Board 的 channel，其中一个发消息，另一个能收到。
- 断开重连：客户端断线后重新连接，仍能收发消息（不要求恢复断线期间错过的消息，那是 F04
  断线重连语义的范围）。
- 多网关实例场景可以先用单实例 + Redis 验证"发布到 Redis、网关订阅"这条链路通了即可，不要求
  本 feature 就搭多实例部署环境。

## 范围与边界
- 本 feature 做：WS 网关最小实现 + Redis pub/sub 广播骨架 + 连接/断开/收发的最小验证。
- 明确不做：Yjs 数据建模、CRDT 合并、awareness、光标/在线状态/跟随视角的具体语义——这些仍是
  现有 F01（Yjs 同步）、F02（在线光标）、F03（跟随协作者）、F04（断线重连指示）的范围，
  它们在这个骨架之上实现业务语义。
- 不依赖 p6 的组件/widget 广度（F14-F20），这个骨架是纯传输层，可以和 p6 并行推进。

## 已知约束 / 依赖
- 依赖的能力平面：CAP-COLLAB。
- 依赖 infra 已有的 Redis（`infra/docker-compose.yml`），不需要新增基础设施依赖。
- 现有 `apps/web/lib/presence.ts`、`lib/collab-bus.ts` 是临时的进程内内存实现，本 feature
  落地后，这两个文件的能力应该逐步被真正的传输层替换（替换时机由 F01-F04 各自决定，不在本
  feature 范围内强制一次性替换）。

## 切分提示（给 requirement-author 的建议）
- 建议作为 p8-collaboration 的新 feature，插在最前面（优先级低于/先于现有 F01），
  标题类似"WebSocket + Redis 广播骨架（不含 Yjs 语义）"。
- 现有 F01（Yjs 实时同步组件变更）的 notes 应该补一条对本 feature 的依赖说明，
  且可以精简掉"新建 packages/collab...Redis fanout"这部分描述（已被本 feature 覆盖），
  F01 聚焦在"把 p6 命令模型映射到 Yjs 共享结构"这部分。
- verification 建议是一个新的 e2e/collab-transport-skeleton.spec.ts，独立于现有四个
  collab-*.spec.ts。
