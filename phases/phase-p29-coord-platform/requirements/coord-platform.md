# p29 需求：协调层按 RepoHub DO 重建并开源产品化（coord-platform）

> 原始需求来源：人类发起（2026-07-18 会话拍板）。本文件是输入，权威是 feature_list.json。
> 关联：ADR-017（本阶段的架构决策）、product-vision-github-agent-layer.md（北极星）、
> postmortem-p23-false-passing.md、agent-scaleup-2026-07.md §4（coord-service 暂停背景）。

## 一、要解决的问题（全部有事故出处，不是推演）

1. **并发认领竞态**（ADR-001/006 起因）：现 D1 coord-service 有 3 个已知 fail-open
   缺陷，推广已暂停——单库多写者模型修复成本 ≈ 重建成本。
2. **数据不实时，靠轮询 + 纪律补偿**：stale fetch 导致 review 误判（P23 postmortem
   两轮不成立的 Block）；PR 卡住要人工记得查 mergeable；等待时长靠 coordinator 自觉追踪。
3. **接入一个新 agent 成本高**：读一堆文档 + registry PR + 人工凭据（#629 已部分解决）。
4. **合并门禁靠约定**：此前私有仓免费套餐无分支保护；仓库现已 public，服务端门禁可立即启用。
5. **"任何 GitHub 项目 5 分钟接入"的产品目标**（北极星）需要协调内核天然按仓库分片。

## 二、已拍板的决策（人类，2026-07-18）

- 不修旧 coord-service，按 **每仓一个 RepoHub Durable Object（SQLite 存储）** 重建。
- 以**本仓开源子项目**形态开发运营：不建独立仓库，域名沿用 develop.boardx.us。
- 命名沿用现有 `coord-*` 家族（coord-repohub / coord-protocol / coord-projection /
  coord-gateway），不引入新品牌。
- License：**Apache-2.0**。
- 三原语 wire format（Lease / Evidence / Events+Andon）作为开放规格维护并记 changelog。
- 平台侧智能：Workers AI 托管开源模型为默认，provider 接口可插拔（与 ADR-016 的
  应用端 Qwen 决策互不冲突——那是应用面，这是协调面）。

## 三、目标架构（Phase A 范围）

```
GitHub(权威) --webhooks--> coord-gateway(Worker+Queues,幂等)
                              └─> RepoHub DO(每仓一个): issue/PR 实时镜像(含 mergeable/SHA)
                                    + 原子租约(claim/heartbeat/TTL/alarm 回收)
                                    + 事件日志 + WebSocket 广播
                              ├─> coord-projection: 租约→check/status, andon→阻断 commit status
                              ├─> REST /realtime/* + MCP server + CLI
                              └─> devportal(原地升级): 实时看板
```

- GitHub 永远是权威；知识永远在 git；供应商中立（接口 = REST + MCP + CLI）。
- RAG 知识层、Actions 独立复核证据门、邮件拍板、项目目录/声誉 → 后续 phase，不进本期。

## 四、十个 feature 的验收意图（细化为 feature_list.json）

- F01 开源就绪与服务端门禁：LICENSE(Apache-2.0)、全历史密钥扫描（报告交人类过目）、
  对外 README/贡献者入口 docs、main 分支保护启用（必须 PR + required checks）。
- F02 协议规格 v0：docs 三原语规格 + packages/coord-protocol 类型与校验 + CHANGELOG。
- F03 GitHub App + webhook ingest：coord-gateway Worker、Queues 削峰、delivery GUID 幂等。
  GitHub App 由人类在 org 下注册（我们提供 manifest/权限清单）。
- F04 RepoHub 实时镜像：issue/PR 镜像（字段必含 mergeable/mergeStateStatus/head SHA），
  `GET /realtime/*`；每条响应带镜像时间戳与 SHA 锚点。
- F05 RepoHub 原子租约：claim/heartbeat/TTL/alarm 回收；释放/回收强制 handoff note；
  并发压测下同一 resource 恰好一个 201，其余 409。
- F06 反向投影：租约→issue check/status；andon→阻断性 commit status（仅 maintainer 级身份可发）。
- F07 MCP + CLI：仓库级 MCP 端点（claim/heartbeat/release/get_realtime_status/
  get_ready_work/submit_evidence 起步）+ `npx` CLI；全新 agent 按文档 5 分钟跑通。
- F08 OAuth + scoped token：devportal 现有自助领 token（ADR-011 P2/P3）升级为按仓 scope。
- F09 门户实时化：devportal 接 RepoHub WebSocket，看板秒级跟随 GitHub 变更。
  **UI 约束（ADR-003）**：复用 p23 已确认 UI，不新增视图/不改布局，只换数据层与新鲜度标识；
  若演进中出现新视图需求，停下来走 ui-signoff，不得夹带。
- F10 本仓割接 + 存量退役：harness lock-*/module-lock-* 切到 coord-gateway；
  packages/coord-service 与 coord-dashboard 中被取代的部分冻结删除；一个真实工作周期
  验证零 stale-fetch 误判、零撞车。

## 五、非目标（防蔓延）

- 不做多租户计费/项目目录/声誉系统（Phase B/C）。
- 不做 RAG 知识检索（Phase B）。
- 不替用户跑构建验证（证据门后置，且跑在用户自己的 Actions 里）。
- 不动 boardx 产品面（apps/web）任何无关代码。
