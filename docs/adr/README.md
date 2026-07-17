# ADR 索引 — 架构决策记录（全局唯一归口）

> 2026-07-12 起（人类拍板）：ADR 是全项目治理文件，统一放这里；此前散在
> `docs/adr/`（ADR-001~013，已迁入）与本目录早期两篇
> （0001/0002，旧编号序列，保留原名）。新 ADR 编号从 ADR-014 起。

| 编号 | 主题 | 状态 |
|---|---|---|
| 0001 | record-architecture-decisions（ADR 实践本身） | 早期 |
| 0002 | board-keyed-items | 早期 |
| ADR-001 | per-owner-in-progress（单一 in_progress 门控） | Accepted |
| ADR-002 | shell-deny-screening | Accepted |
| ADR-003 | ui-first-signoff-gate（UI 先行人类确认） | Accepted |
| ADR-004 | issues-as-coordination-bus | Superseded by ADR-009 |
| ADR-005 | shared-checkout-isolation（worktree 隔离） | Accepted |
| ADR-006 | coord-service-d1-gating | Superseded by ADR-009 |
| ADR-007 | docker-stack-teardown（破坏性清理治理） | Accepted |
| ADR-008 | coord-service-primary-mechanism-staging | Accepted |
| ADR-009 | github-coordination-plane-retirement（D1 唯一协调权威） | Accepted |
| ADR-010 | agent-org-model（三级 coordinator + 3h 周期） | Accepted |
| ADR-011 | self-service-identity-registration（开发者一等实体） | Proposed |
| ADR-012 | audit-chain-hardening（doctor + 证据纪律） | Accepted |
| ADR-013 | contrast-safety-single-source（样式单源策略） | Accepted |
| ADR-016 | app-default-ai-provider-qwen（应用端默认 AI 用 Qwen） | Accepted |
