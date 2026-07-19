# 组织本体与知识图谱数据架构（Knowledge & Ontology）

> 2026-07-15 人类拍板的正式选型（取代"pgvector/AGE 只是注释预留"的状态）。
> **此前该规格只存在于架构总结 Artifact 中，本文件是它的仓内权威落盘**——
> 后续任何 RAG/记忆/检索类 feature（p10-F04、p19 AVA 记忆、M-A 知识索引）都应对齐本架构。核心立场：**canonical 永远是
> Postgres 关系表，图和向量都是可重建的投影**——这让整套东西保持可移植（任何
> 能跑 PG 的地方都能跑），且灾难恢复 = 重放迁移 + 重建投影。

## 存储分工（一个 PG，三种视图）

| 组件 | 角色 | 铁律 |
|---|---|---|
| **PostgreSQL** | canonical：`ontology_objects` / `ontology_edges` / `context_nodes` / `ontology_actions` 四张核心表 | 唯一事实源；每行必带 tenant / privacy / permission / confidence / review 状态 / 生命周期字段 |
| **pgvector** | 嵌入索引（同库扩展） | 只是索引，不是事实 |
| **Apache AGE** | 图投影（同库扩展，openCypher 查询） | **可重建**：从 ontology_objects/edges 全量重放即可恢复；**AGE 不可用时不许静默降级为纯向量 RAG**——要么显式报"图检索不可用"，要么修，不许假装没事 |
| Redis | 仅运行时缓存 | 可丢失，不可作为事实源 |
| 对象存储 | 工件本体（文档/截图/导出物） | PG 里只存指针+哈希 |

## 组织本体建模（什么进图谱）

组织的一切一等实体都是 `ontology_objects` 的一行，关系是 `ontology_edges`：

```
人（developer）──owns──▶ agent ──claims──▶ feature ──belongs_to──▶ sprint/phase
   │                      │                   │
   │                      └──produced──▶ PR ──verified_by──▶ evidence
   ├──decided──▶ ADR ◀──superseded_by── ADR
   └──authored──▶ 知识条目（skill 踩坑经验/postmortem 结论）──about──▶ 模块
```

harness 的文件事实（registry.yaml、feature_list.json、ADR、skill 经验条目）是这些
实体的**权威来源**——本体表从它们同步派生，不反向。这保持了"仓库即唯一事实来源"
的硬约束：图谱是仓库的索引，不是第二个真相。

## 写入纪律：一切变更走 ontology_actions

- **agent 不直写本体表**。所有写入提交为 `ontology_actions`（append-only 动作日志：
  谁/何时/什么操作/置信度/依据链接），由执行器校验后落表。
- 好处：审计链天然完整（同 harness 的证据纪律）；可回放；坏写入可定位到动作而非
  只能看到脏状态。
- 前端画布/可视化（如 React Flow）的状态**不是本体真相**——它只是视图，保存 =
  提交 actions，不是序列化画布。

## 检索策略：graph-first, vector-second

1. 先图：从查询实体出发走 openCypher 拓扑（k-hop 邻域/路径），拿**结构化上下文**。
2. 后向量：图圈定的候选集内做 pgvector 相似度补召回。
3. 兜底顺序不可颠倒——纯向量 RAG 对组织本体这种强关系数据会丢关键结构
   （"谁决定的、被什么取代、证据在哪"是边，不是文本相似度）。

## AI 边界与隐私

- **Context OS 是唯一 AI 边界**：模型只通过它取上下文，不许绕过直查库。
- **Privacy Engine 管脱敏**：出边界前按行级 privacy/permission 字段过滤与脱敏；
  tenant 隔离在查询层强制，不靠调用方自觉。

## 落地迭代（O1–O7 摘要）

O1 四表 + 迁移 → O2 actions 执行器 → O3 同步器（harness 文件 → 本体） →
O4 pgvector 嵌入管道 → O5 AGE 投影 + 重建脚本 → O6 graph-first 检索 API →
O7 Context OS + Privacy Engine。每步都有独立验证命令，按 harness 流程走
feature_list，**不许跳步**（尤其不许先上向量检索后补图——会退化成永远补不上）。

## 与现状的两个已知衔接点（接入时拍板）

1. 迁移工具归一：本模板立场是显式 SQL + 自研 runner（可审计）；若你的项目用 ORM
   迁移，选一个，别混用。
2. AGE 部署形态：当前镜像是 pgvector/pg16 **不含 AGE**，需自建镜像（pgvector+AGE
   同装）并更新 devapp compose；此项与迁移工具归一（规格写 TypeORM，仓库现为
   显式 SQL + 自研 runner——立场：沿用显式 SQL）同为接入前待拍板项。
