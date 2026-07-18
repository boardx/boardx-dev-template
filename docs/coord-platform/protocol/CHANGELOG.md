# coord 协议 CHANGELOG

规格版本独立于实现版本；wire format 变更**必须**在此登记（ADR-017 §4，
北极星 §7.5"协议即规格"）。语义化：破坏性变更升 minor（0.x 阶段）。

## coord/0.1.3 — 2026-07-19

**加法扩展（非破坏）：工作区分片事件六类型**（p30/F04：需求流水线条目 /
sprint 面板数据 / talk 对话流迁入按项目分片的 RepoHub DO）。

- 事件封闭集合新增 `requirement.submitted` / `requirement.advanced` /
  `requirement.dispatched` / `requirement.rejected` / `sprint.upserted` /
  `talk.posted`，payload 校验入 `validateEvent`（requirement.\* 必含
  `requirement_id`，advanced 另需合法 `status`；sprint.upserted 必含
  `sprint` + `item_id`；talk.posted 必含 `message_id`）。
- 需求流水线五态定稿：`submitted → analyzing → in_review → dispatched`
  （提交→分析→审核→下发 happy path），`rejected` 为审核拒绝终态。
- 版本判定理由：与 0.1.1/0.1.2 完全同型——信封结构、既有 24 个类型、全部请求/响应
  wire format 不变，仅扩事件类型集合，按语义化是 **patch（0.1.3）**。wire 上的
  `protocol` 字段维持 `"coord/0.1"` 不动（理由同 0.1.1：升 tag 即人为破坏）。
- 不认识新类型的旧消费者按「未知类型忽略」处理（事件流前向兼容既定要求）。

## coord/0.1.2 — 2026-07-19

**加法扩展（非破坏）：directory.\* 事件九类型**（p30/F01：平台目录 DO
PlatformDirectory——Project/Engineer/Membership/Agent/Enrollment 领域模型，
与按仓分片的 RepoHub 互补的平台级单例）。

- 事件封闭集合新增 `directory.project.registered` / `directory.engineer.upserted` /
  `directory.membership.requested` / `directory.membership.transitioned` /
  `directory.agent.enrolled` / `directory.agent.updated` /
  `directory.agent.heartbeat` / `directory.enrollment.created` /
  `directory.enrollment.revoked`。目录 DO 的每条写路径（仅限身份/授权/审批，
  三条铁律）都 emit 对应审计事件，复用统一事件信封（p30 需求 N5「一切
  身份/授权/审批动作入只增审计」）。
- payload 不做强校验（实体细节是目录 DO 的实现域，字段随 UI 需要演进；
  信封校验照旧）。不认识 directory.* 的旧消费者按「未知类型忽略」前向兼容。
- 版本判定：与 task.\* 先例（0.1.1）同理——仅扩事件类型集合，wire 上的
  `protocol` 字段维持 `"coord/0.1"` 不动，按语义化是 **patch（0.1.2）**。

## coord/0.1.1 — 2026-07-18

**加法扩展（非破坏）：task.\* 事件四类型**（F10 前置：tasks 收件箱与派工 broker
从冻结退役中的 coord-service D1 迁入 RepoHub DO）。

- 事件封闭集合新增 `task.dispatched` / `task.acked` / `task.completed` /
  `task.recalled`，payload 校验入 `validateEvent`（task_id 必填；dispatched
  另需 assignee + priority）。语义承接 D1 events 的
  task-dispatch/ack/done/recall（#614/#631）。
- 版本判定理由：信封结构、既有 11 个类型、全部请求/响应 wire format 均不变，
  仅扩事件类型集合——按语义化是 **patch（0.1.1）而非 0.2**。wire 上的
  `protocol` 字段维持 `"coord/0.1"` 不动：升 tag 会让所有已部署校验器
  （`protocol === "coord/0.1"` 强等判定）拒收新消息，属于人为制造破坏；
  0.x 阶段只有破坏性变更才升 minor 并更换 wire tag。
- 不认识 task.* 的旧消费者按「未知类型忽略」处理即可（事件流本就要求
  消费者对新增类型前向兼容）。

## coord/0.1 — 2026-07-18

首个公开版本。三原语定稿：

- **lease.md**：ClaimRequest / Lease / Heartbeat / Release；资源命名；
  409 冲突语义；handoff_note 必填；与存量 D1 claims 的字段映射。
- **evidence.md**：EvidenceManifest / VerificationVerdict；head_sha 锚定；
  check run 投影语义。
- **events.md**：统一事件信封；11 个事件类型封闭集合；WebSocket/拉取订阅；
  andon 特权事件与阻断投影。

继承声明:语义承接 ADR-009（原子租约、events 唯一可信历史）与 ADR-012
（证据纪律）；载体为 RepoHub DO（ADR-017）。
