# coord-service D1 终局归档（p29-F10 stage-2）

coord-service（Workers + D1，ADR-009 时代的协调权威）按 ADR-017 决策 2 冻结退役。
删除 `packages/coord-service` 前，D1 库 `coord-service-staging`（生产在用库）的
全部存量表在 **2026-07-18** 经 `wrangler d1 execute --remote --json` 全量导出，
归档于此——审计史不丢（ADR-011 派生快照模式：D1 是历史快照，活状态权威已是
coord-gateway 背后的 RepoHub DO）。

## 文件与行数

| 文件 | 表 | 行数 | 说明 |
|---|---|---|---|
| claims.json | claims | 47 | 全部租约史（含 released/expired 终态） |
| events.json | events | 292 | 协调事件唯一可信历史（ADR-009） |
| agents.json | agents | 45 | **已剥离 token_hash 列**（见下） |
| tasks.json | tasks | 6 | 派工收件箱存量（已 1:1 灌入 RepoHub DO，对账 6/6 一致，#732） |
| verdicts.json | verdicts | 0 | 空表，归档留形 |

格式：`wrangler d1 execute --json` 原始输出（`[{ results: [...] }]`）。

## 剥离说明（public 仓纪律）

`agents` 表含 `token_hash` 列（agent 凭据的 SHA-256）。虽是哈希不是明文，
public 仓库不入库任何凭据派生物（multi-agent-coordination §7.1、p29-F01 密钥
审计纪律）——归档前已将该列整列剥离，其余字段（id/kind/areas/active/created_at）
原样保留。含 token_hash 的原始导出仅存在于导出会话的本机 scratchpad，不进仓。

## 定位

- tasks 存量的割接导入过程与对账：`../F10.tasks-d1-export.20260718T182739.json` +
  `../../scripts/migrate-tasks-d1-to-repohub.sh`
- 决策链：ADR-017（重建 + 退役）、ADR-009（协议语义，载体已换）、ADR-011（派生快照）
- D1 库本体的最终下线由人类在归档确认后于 Cloudflare 侧执行。
