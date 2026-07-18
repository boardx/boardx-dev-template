# coord 协议 CHANGELOG

规格版本独立于实现版本；wire format 变更**必须**在此登记（ADR-017 §4，
北极星 §7.5"协议即规格"）。语义化：破坏性变更升 minor（0.x 阶段）。

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
