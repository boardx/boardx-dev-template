# Evidence 原语 v0.1 — 完成声明与独立复核 wire format

> 三原语之二。把 harness 的"没有证据 = 没有完成"（AGENTS.md 完成定义 + ADR-012
> 审计链纪律）标准化为可跨仓库使用的消息格式。核心思想：**agent 的"做完了"是
> 声明（manifest），不是事实；事实由独立复核（verdict）产生，两者都是留痕对象。**

## EvidenceManifest（agent 提交的完成声明）

```json
{
  "protocol": "coord/0.1",
  "manifest_id": "evm_01J...",
  "resource_id": "feature:p29/F02",
  "agent_id": "wrk-coord-1",
  "head_sha": "ee921c09...",
  "attestations": [
    {
      "command": "pnpm --filter @repo/coord-protocol test",
      "exit_code": 0,
      "output_digest": "sha256:ab12...",
      "output_excerpt": "Tests  12 passed (12)",
      "log_url": "phases/phase-p29-coord-platform/evidence/F02.verify.log"
    }
  ],
  "attested_at": "2026-07-18T04:00:00Z"
}
```

- **`head_sha` 必填**：声明锚定到具体 commit（P23 postmortem 铁律——指控与修复必须
  锚定同一 SHA，stale 读判定从此可机械化）。
- `attestations[]` 每条对应 feature 的一条 verification 命令；`exit_code` 必须为 0
  才构成有效声明；`output_excerpt` 须含真实输出（如 `N passed`），裸时间戳不是证据。
- `log_url` 指向完整日志（仓内路径或 R2 归档 URL）。

## VerificationVerdict（独立复核结论）

```json
{
  "protocol": "coord/0.1",
  "verdict_id": "vrd_01J...",
  "manifest_id": "evm_01J...",
  "resource_id": "feature:p29/F02",
  "verifier": { "kind": "independent-rerun", "agent_id": "rev-e2e" },
  "head_sha": "ee921c09...",
  "verified": true,
  "checks": [
    { "command": "pnpm --filter @repo/coord-protocol test", "claimed_exit": 0, "rerun_exit": 0, "match": true }
  ],
  "notes": "",
  "verified_at": "2026-07-18T04:10:00Z"
}
```

- `verifier.kind` ∈ `independent-rerun`（在干净环境重跑命令）| `reviewer-attest`
  （reviewer 人工/agent 复核）| `ci`（Actions required check）。
- `verified=false` 时 `notes` 必填（哪条 check 不匹配、复现路径）。
- **verdict 与 manifest 的 `head_sha` 不一致 → verdict 无效**（复核的是旧代码）。

## 投影语义（GitHub 原生物件）

- manifest 提交 → PR 上出现 check run `coord/evidence`，状态 neutral
  （"声称 N 项验证通过，待独立复核"）。
- verdict verified=true → 该 check run 转 success；false → failure + notes 摘要。
- 该 check 可被仓库设为 required——evidence 纪律从约定升级为合并门禁。

## 与 harness verify 的关系

`pnpm harness verify --sprint` 是本原语的一个生产者实现：它产出的
evidence 日志 + feature_list 翻转，等价于 manifest + verdict(independent-rerun)
一体完成。Phase C 起 verify 直接生成标准 manifest 上报。
