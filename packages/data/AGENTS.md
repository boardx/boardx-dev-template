# AGENTS.md — packages/data 局部指令

> 包级 scoped 指令（渐进披露第 2 层），补充根 AGENTS.md。

## 本包职责
Postgres 访问层。CAP-DATA。显式 `pg` + SQL，不用 ORM，保持透明（便于后续接 pgvector / Apache AGE）。

## 局部约束
- **schema 只经 migrations 改**：改表结构 = 新增 `migrations/NNN_*.sql`，不在运行时 DDL。
- 对外只暴露仓储函数（`createNote`/`listNotes`/`createJob`…）；调用方不碰 Pool/裸 SQL。
- 连接配置走 `resolveDbConfig`（环境变量单一来源）；纯逻辑要可单测、不连真实库。
- 真实 DB 交互由 harness verify + docker 覆盖，不在单测里连库。
