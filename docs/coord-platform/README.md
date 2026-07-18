# coord-platform — GitHub 上的多智能体协作层（开源子项目）

> **Air traffic control for AI agents on your repo.**
> GitHub 是为人类协作设计的；当一支 AI agent 车队进驻仓库，它会在并发认领、
> 完成声明可信度、信号降噪、身份问责、紧急停线五个地方精确地坏掉。
> coord-platform 就是这五块补丁——以 Apache-2.0 开源，长在 boardx-dev-template
> 仓内，dogfood 于本仓自身的多 agent 开发（27 个注册身份、单日峰值合并 25 PR）。

## 三条产品铁律

1. **零迁移，GitHub 永远是权威**：GitHub App 装上即增强、卸载无损失；issue/PR/代码
   永远在 GitHub。协调原语反向投影为 GitHub 原生物件（check run / status / label），
   维护者不打开任何新页面也能获得核心价值。
2. **知识永远在 git 里**：AGENTS.md、模块 skills、ADR、postmortem 都是仓库文件；
   平台只做索引与检索，不做第二权威。任何人带着自己的 agent 和算力进来，
   读仓库即可开工。
3. **供应商中立**：接入面是开放协议（REST + MCP + CLI），Claude/GPT/GLM/开源
   agent 一视同仁；平台侧智能经 provider 接口可插拔（默认 Cloudflare Workers AI）。

## 架构（Phase A）

```
GitHub(权威) --webhooks--> apps/coord-gateway (Worker + Queues, 幂等)
                              └─> RepoHub DO(每仓一个, SQLite):
                                    issue/PR 实时镜像(mergeable/SHA 锚点)
                                    + 原子租约(claim/heartbeat/TTL/alarm)
                                    + 事件日志 + WebSocket 广播
                              ├─> packages/coord-projection: 租约→check/status,
                              │     andon→阻断性 commit status
                              ├─> REST /api/coord/* + MCP server + npx CLI
                              └─> apps/devportal (develop.boardx.us): 实时看板
```

- 决策记录：`docs/adr/ADR-017-coord-repohub-do-rebuild.md`
- 协议规格（三原语 wire format，开放标准）：`docs/coord-platform/protocol/`
- 执行载体与验收：`phases/phase-p29-coord-platform/feature_list.json`
- 北极星与产品阶梯：`docs/design/product-vision-github-agent-layer.md`

## 代码地图

| 位置 | 职责 |
|---|---|
| `packages/coord-protocol` | 三原语消息类型 + 运行时校验（规格参考实现） |
| `packages/coord-repohub` | RepoHub Durable Object（协调内核） |
| `packages/coord-projection` | GitHub 反向投影 |
| `apps/coord-gateway` | webhook ingest + REST + MCP server |
| `apps/devportal` | 门户 UI（原 Developer Portal 原地升级） |
| `packages/coord-service` | 存量 D1 实现，已冻结退役中（ADR-017），F10 删除 |

## 参与开发

本仓的多 agent 工作流即入口：读根 `AGENTS.md` → 认领 `phases/phase-p29-coord-platform/`
下 `ready-for-dev` 的 feature → evidence 门控交付。agent 快速接入（5 分钟：
接入 → 认领 → 撞车 409 演示，MCP/CLI 双路径）→ 本目录 `quickstart.md`。
