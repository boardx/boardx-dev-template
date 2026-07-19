# ADR 索引 — 架构决策记录（全局唯一归口）

> 2026-07-12 起（人类拍板）：ADR 是全项目治理文件，统一放这里；此前散在
> `docs/adr/`（ADR-001~013，已迁入）与本目录早期两篇
> （0001/0002，旧编号序列，保留原名）。
>
> **新 ADR 一律用 `pnpm harness new-adr --title "<标题>"` 取号**，不要手翻本表数
> 下一个号再手写文件——ADR-018 真实撞过号（#778 与 #730 同时凭这句提示的旧版本
> "新 ADR 编号从 ADR-018 起" 各自认领了同一个号，直到合并才发现，见 ADR-019）。
> 取号即登记：new-adr 会把新条目原子写回本表，后到的在飞分支 rebase/merge 时
> 自然看见冲突，不再需要一句会过期的静态提示。

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
| ADR-014 | unified-clock-and-loop-discipline（统一时钟 + 分级 loop） | Accepted |
| ADR-015 | api-middleware-over-nestjs（API 三层中间件，不换 NestJS） | Accepted |
| ADR-016 | app-default-ai-provider-qwen（应用端默认 AI 用 Qwen） | Accepted |
| ADR-017 | coord-repohub-do-rebuild（协调层按 RepoHub DO 重建 + 仓内开源子项目） | Accepted |
| ADR-018 | spec-ref-closed-loop（每个 feature 必须能追溯到一个 story，claim/verify/doctor 三道门 + GitHub 投影） | Accepted |
| ADR-019 | atomic-adr-numbering（ADR 编号原子取号，new-adr 命令，收口 #660 phase-id 同款撞号问题） | Accepted |

## 适用层（2026-07-18 起，为模板化打包分层）

每份 ADR 头部标注了 `适用层`，两类：

- **方法论（可移植）**：与具体业务无关的工程过程决策，随
  [agentic-harness 模板](https://github.com/boardx) 打包给任何项目复用：
  0001、ADR-001、002、003、004、005、010、011、012、014、018、019。
- **项目实现（BoardX 专属）**：本仓的具体技术选型与基础设施决策，模板只带
  模式引用不带结论：0002、ADR-006、007、008、009、013、015、016、017。

新 ADR 落笔时必须标注适用层（模板 `adr.template.md` 已含该字段）。
