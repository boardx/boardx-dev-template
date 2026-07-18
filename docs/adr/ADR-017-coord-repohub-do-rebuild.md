# ADR ADR-017: 协调层按 RepoHub Durable Object 重建，以仓内开源子项目形态产品化

- 状态: Accepted（人类拍板 2026-07-18）
- 适用层：项目实现（BoardX 专属：模板只带模式引用）
- 日期: 2026-07-18
- 关联: ADR-009（协调权威语义，本 ADR 换其载体）、ADR-011（身份/token，被 F08 继承扩展）、
  ADR-016（应用端 AI provider，与本 ADR 的平台侧 AI 互不冲突）、
  `docs/design/product-vision-github-agent-layer.md`（北极星）、
  `phases/phase-p29-coord-platform/`（执行载体）

## 背景

1. **存量 coord-service（D1）不可救**：三个已知 fail-open 缺陷（`queryActiveClaim` 静默
   fail-open 等，见 agent-scaleup-2026-07 §4），推广已暂停；修复成本 ≈ 重建成本，且单库
   多写者模型是缺陷的结构性根源。
2. **八类历史事故要求把纪律升级为结构**：并发认领竞态（ADR-001/006）、假 passing
   （P23 postmortem：25 phase 共 85 处审计链断裂）、stale fetch 误判（同 postmortem
   §诚实附注）、凭据人工分发（ADR-011 起因）、合并门禁靠约定（无分支保护）等——
   现有解法多为"SOP 纪律补偿架构缺陷"。
3. **产品化目标**（北极星）：任何 GitHub 项目 5 分钟接入的 agent 协调层，要求内核
   天然按仓库分片、数据实时、接口供应商中立。
4. 独立仓库方案（workspacex.us）经评估后被人类否决：双仓同步成本 + harness 治理断层。
   仓库现已 public，服务端门禁的前置条件已成立。

## 决策

1. **协调内核按"每仓一个 RepoHub Durable Object（SQLite 存储）"重建**：
   原子租约（DO 单线程串行执行从结构上消灭竞态类 fail-open）、issue/PR 实时镜像
   （webhook 驱动，字段含 mergeable/mergeStateStatus/head SHA）、事件日志、
   WebSocket 实时广播。**ADR-009 的协议语义不变**（claim/heartbeat/TTL/机械回收、
   events 为唯一可信历史），仅更换实现载体。
2. **存量 `packages/coord-service` 冻结退役**：不再修复、不再发放新凭据（与现行暂停
   状态一致）；p29-F10 割接完成后删除，D1 存量 claims/events 导出归档（审计史不丢）。
3. **以本仓开源子项目形态开发运营**：`apps/coord-gateway` + `packages/coord-repohub|
   coord-protocol|coord-projection`，命名沿用现有 `coord-*` 家族，不引入新品牌；
   devportal 原地升级为门户，域名沿用 develop.boardx.us；本仓自身为租户 #1。
4. **开源与门禁**：License 采用 **Apache-2.0**；三原语 wire format（Lease / Evidence /
   Events+Andon）在 `docs/coord-platform/protocol/` 作为开放规格维护并记 changelog；
   仓库（已 public）启用 main 分支保护（必须 PR + required checks），把"coord-main
   独占合并权"的纪律兜底升级为服务端强制。
5. **平台侧智能可插拔**：经 provider 接口调用，默认 Cloudflare Workers AI 托管开源
   模型，可配置外接更强模型。（应用端默认 provider 仍按 ADR-016 = Qwen，两者是
   不同平面。）
6. **agent 接入面 = REST + MCP + CLI**：供应商中立，任何支持 MCP 的 agent 一个 URL
   接入；token 按仓 scope、自助领取（继承 ADR-011 P2/P3）。

## 后果

**正面**
- 竞态、实时性、多仓分片三类结构性问题一次解决；stale-fetch/撞车类事故从"靠 SOP
  记住"变为"架构上不可能"。
- 服务端合并门禁落地，harness 的 evidence 纪律获得平台级强制点（后续 phase 的
  证据门可投影为 required check）。
- 单仓治理：devportal 零迁移，phase/verify/evidence 全套纪律直接管辖新子项目。
- 开源 + 开放协议与北极星的"协议即事实标准"路线一致。

**负面 / 代价**
- 重建期内本仓协调继续用 GitHub label 状态机（现状不变，无退化，但红利延后到 F10 割接）。
- public 仓库敏感信息纪律成为硬约束（multi-agent-coordination §7.1），F01 须完成
  全历史密钥审计并处置。
- DO 生态较 D1 新，alarm/hibernation 行为需要一轮真实 soak（F10 的"一个完整工作
  周期零事故"即为 soak 验收）。
- coord-dashboard 中与 D1 直连的读路径需随 F10 切换，短期内存在双实现窗口。

## 执行

载体：`phases/phase-p29-coord-platform/`（F01–F10，wave 划分见 feature_list）。
本 ADR 合并即生效；F10 完成后在本文件追加"割接完成"备注与证据链接。

> **割接注记（2026-07-18，p29-F10 stage-2）**：决策 2 已执行——`packages/coord-service`
> 与 `deploy-coord-service.yml` 从仓库删除；harness 锁/时钟/收件箱、devportal、
> coord-dashboard、apps/web 管理面全部指向 coord-gateway（ADR-014 权威时钟迁至
> gateway `GET /api/coord/time`，cycle 语义零变更）；D1 存量（claims 47 / events 292 /
> agents 45（已剥离 token_hash）/ tasks 6 / verdicts 0）归档于
> `phases/phase-p29-coord-platform/evidence/d1-final-archive/`。F10 的 verify 翻转与
> "一个完整工作周期零事故" soak 验收随后续周期完成后再补最终备注。
